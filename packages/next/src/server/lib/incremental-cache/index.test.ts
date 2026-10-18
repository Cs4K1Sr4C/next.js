import { CacheHandler, IncrementalCache } from './index'
import { RouteKind } from '../../route-kind'
import {
  CachedRouteKind,
  type CachedFetchValue,
  type IncrementalCacheValue,
} from '../../response-cache'

const cacheHandlersSymbol = Symbol.for('@next/cache-handlers')
const preview = {
  previewModeId: 'id',
  previewModeSigningKey: 'key',
  previewModeEncryptionKey: 'key',
}
const twoMB = 2 * 1024 * 1024

function createCache({
  dev = false,
  custom = false,
}: {
  dev?: boolean
  custom?: boolean
} = {}) {
  const set = jest
    .fn<ReturnType<CacheHandler['set']>, Parameters<CacheHandler['set']>>()
    .mockResolvedValue(undefined)
  class Handler extends CacheHandler {
    set = set
  }
  // A global FetchCache is used when no custom handler is configured, which
  // keeps the 2MB limit in effect while still letting us observe stores.
  ;(globalThis as any)[cacheHandlersSymbol] = custom
    ? undefined
    : { FetchCache: Handler }
  const cache = new IncrementalCache({
    dev,
    requestHeaders: {},
    previewProps: preview,
    prerenderManifest: {
      version: 4,
      routes: {},
      dynamicRoutes: {},
      notFoundRoutes: [],
      preview,
    },
    CurCacheHandler: custom ? Handler : undefined,
  })
  expect(cache.hasCustomCacheHandler).toBe(custom)
  return { cache, set }
}

function fetchValue(bodySize: number): CachedFetchValue {
  return {
    kind: CachedRouteKind.FETCH,
    data: {
      headers: {},
      body: 'x'.repeat(bodySize),
      status: 200,
      url: 'https://example.com/data',
    },
    revalidate: 60,
  }
}

const bytes = (size: number) => Buffer.alloc(size, 1)
const responseValues: [
  string,
  RouteKind,
  string,
  Exclude<IncrementalCacheValue, CachedFetchValue>,
][] = [
  [
    'APP_PAGE',
    RouteKind.APP_PAGE,
    '/blog/[slug]/page',
    {
      kind: CachedRouteKind.APP_PAGE,
      html: '<p>hello</p>',
      rscData: bytes(64 * 1024),
      headers: {},
      postponed: undefined,
      status: 200,
      segmentData: new Map([['/_tree', bytes(1024)]]),
    },
  ],
  [
    'APP_ROUTE',
    RouteKind.APP_ROUTE,
    '/blog/[slug]/route',
    {
      kind: CachedRouteKind.APP_ROUTE,
      body: bytes(64 * 1024),
      status: 200,
      headers: {},
    },
  ],
  [
    'PAGES',
    RouteKind.PAGES,
    '/blog/[slug]',
    {
      kind: CachedRouteKind.PAGES,
      html: '<p>hello</p>',
      pageData: { pageProps: { items: [1, 2, 3] } },
      headers: undefined,
      status: 200,
    },
  ],
]

describe('IncrementalCache.set fetch size limit', () => {
  let stringify: jest.SpyInstance
  let toJSON: jest.SpyInstance
  let warn: jest.SpyInstance

  // Counts how often `set` serialized this exact value to measure its size.
  const serializations = (value: unknown) =>
    stringify.mock.calls.filter(([arg]) => arg === value).length

  beforeEach(() => {
    stringify = jest.spyOn(JSON, 'stringify')
    toJSON = jest.spyOn(Buffer.prototype, 'toJSON')
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete (globalThis as any)[cacheHandlersSymbol]
  })

  describe.each([
    ['default handler', false],
    ['custom handler', true],
  ] as const)('with %s', (_, custom) => {
    it.each(responseValues)(
      'does not serialize %s entries',
      async (_kind, routeKind, sourceRoute, value) => {
        const { cache, set } = createCache({ custom })
        await cache.set('/blog/post', value, {
          route: { kind: routeKind, sourceRoute },
          cacheControl: { revalidate: 60, expire: undefined },
        })

        expect(serializations(value)).toBe(0)
        expect(toJSON).not.toHaveBeenCalled()
        expect(warn).not.toHaveBeenCalled()
        expect(set).toHaveBeenCalledTimes(1)
        expect(set.mock.calls[0][1]).toBe(value)
      }
    )
  })

  it('does not serialize fetch entries for a custom handler', async () => {
    const { cache, set } = createCache({ custom: true })
    const value = fetchValue(twoMB + 1)
    await cache.set('fetch-key', value, { fetchCache: true })

    expect(serializations(value)).toBe(0)
    expect(warn).not.toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith('fetch-key', value, { fetchCache: true })
  })

  it('does not serialize implicit build-time fetch entries', async () => {
    const { cache, set } = createCache()
    const value = fetchValue(twoMB + 1)
    const ctx = { fetchCache: true, isImplicitBuildTimeCache: true } as const
    await cache.set('fetch-key', value, ctx)

    expect(serializations(value)).toBe(0)
    expect(warn).not.toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith('fetch-key', value, ctx)
  })

  it('stores fetch entries within the limit', async () => {
    const { cache, set } = createCache()
    const value = fetchValue(1024)
    await cache.set('fetch-key', value, { fetchCache: true })

    expect(serializations(value)).toBe(1)
    expect(warn).not.toHaveBeenCalled()
    expect(set).toHaveBeenCalledWith('fetch-key', value, { fetchCache: true })
  })

  it.each([
    ['https://example.com/data', 'https://example.com/data'],
    [undefined, 'fetch-key'],
  ])(
    'warns and skips oversized fetch entries (fetchUrl: %s)',
    async (fetchUrl, label) => {
      const { cache, set } = createCache()
      const value = fetchValue(twoMB)
      const size = JSON.stringify(value).length
      expect(size).toBeGreaterThan(twoMB)
      await cache.set('fetch-key', value, { fetchCache: true, fetchUrl })

      expect(warn).toHaveBeenCalledTimes(1)
      expect(warn).toHaveBeenCalledWith(
        `Failed to set Next.js data cache for ${label}, items over 2MB can not be cached (${size} bytes)`
      )
      expect(set).not.toHaveBeenCalled()
    }
  )

  it('throws for oversized fetch entries in dev', async () => {
    const { cache, set } = createCache({ dev: true })
    const value = fetchValue(twoMB)
    const size = JSON.stringify(value).length
    await expect(
      cache.set('fetch-key', value, {
        fetchCache: true,
        fetchUrl: 'https://example.com/data',
      })
    ).rejects.toThrow(
      `Failed to set Next.js data cache for https://example.com/data, items over 2MB can not be cached (${size} bytes)`
    )
    expect(warn).not.toHaveBeenCalled()
    expect(set).not.toHaveBeenCalled()
  })
})
