import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import FileSystemCache from 'next/dist/server/lib/incremental-cache/file-system-cache'
import { nodeFs } from 'next/dist/server/lib/node-fs-methods'
import {
  CachedRouteKind,
  IncrementalCacheKind,
} from 'next/dist/server/response-cache'

// The memory cache is a process-wide singleton, so every FileSystemCache in
// this file shares one LRU with this size limit.
const MAX_MEMORY_CACHE_SIZE = 100

describe('FileSystemCache memory cache with an entry that outgrows it', () => {
  let serverDistDir: string
  let consoleWarnSpy: jest.SpyInstance

  beforeEach(async () => {
    serverDistDir = await fs.mkdtemp(join(tmpdir(), 'next-oversized-memory-'))
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(async () => {
    consoleWarnSpy.mockRestore()
    await fs.rm(serverDistDir, { recursive: true, force: true })
  })

  function createCache(flushToDisk: boolean) {
    return new FileSystemCache({
      _requestHeaders: {},
      flushToDisk,
      fs: nodeFs,
      serverDistDir,
      revalidatedTags: [],
      maxMemoryCacheSize: MAX_MEMORY_CACHE_SIZE,
    })
  }

  function routeValue(body: string) {
    return {
      kind: CachedRouteKind.APP_ROUTE as const,
      body: Buffer.from(body),
      headers: { 'content-type': 'text/plain' },
      status: 200,
    }
  }

  const getContext = {
    kind: IncrementalCacheKind.APP_ROUTE,
    isFallback: undefined,
  } as const

  it('serves the fresh disk entry instead of the superseded memory entry', async () => {
    const fsCache = createCache(true)
    const key = '/oversized-route'

    await fsCache.set(key, routeValue('small'), {})
    const first = await fsCache.get(key, getContext)
    expect(first?.value).toEqual(routeValue('small'))

    const largeBody = 'x'.repeat(MAX_MEMORY_CACHE_SIZE * 2)
    await fsCache.set(key, routeValue(largeBody), {})
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Single item size exceeds maxSize'
    )

    const second = await fsCache.get(key, getContext)
    expect(second?.value).toEqual(routeValue(largeBody))
  })

  it('misses instead of serving the superseded memory entry when not flushing to disk', async () => {
    const fsCache = createCache(false)
    const key = '/oversized-route-memory-only'

    await fsCache.set(key, routeValue('small'), {})
    expect((await fsCache.get(key, getContext))?.value).toEqual(
      routeValue('small')
    )

    await fsCache.set(
      key,
      routeValue('x'.repeat(MAX_MEMORY_CACHE_SIZE * 2)),
      {}
    )

    expect(await fsCache.get(key, getContext)).toBeNull()
  })
})
