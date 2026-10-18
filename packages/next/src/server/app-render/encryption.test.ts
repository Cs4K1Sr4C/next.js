import { AsyncLocalStorage } from 'async_hooks'

import { CacheSignal } from './cache-signal'
import {
  createPrerenderResumeDataCache,
  createRenderResumeDataCache,
  type ResumeDataCache,
} from '../resume-data-cache/resume-data-cache'
import type { WorkUnitStore } from './work-unit-async-storage.external'

let mockEncryptionKey: string | undefined
let mockHangingInputController: AbortController | undefined

jest.mock('server-only', () => ({}), { virtual: true })

// Outside of a React render, `React.cache` calls the function without caching.
jest.mock(
  'react',
  () => ({ __esModule: true, default: { cache: (fn: unknown) => fn } }),
  { virtual: true }
)

// Serialize the bound args deterministically, like Flight does in production,
// so that the same args always produce the same `encryptedBoundArgs` cache key.
jest.mock(
  'react-server-dom-webpack/server',
  () => ({ renderToReadableStream: (args: unknown[]) => JSON.stringify(args) }),
  { virtual: true }
)

jest.mock('react-server-dom-webpack/client', () => ({}), { virtual: true })

jest.mock('../stream-utils/node-web-streams-helper', () => ({
  streamToString: async (serialized: string) => {
    // Simulates the hanging input signal aborting while the bound args are
    // still being serialized, which eagerly starts the cache read.
    mockHangingInputController?.abort()
    return serialized
  },
}))

jest.mock('../lib/source-maps', () => ({}))

jest.mock('./manifests-singleton', () => ({
  getClientReferenceManifest: () => ({ clientModules: {} }),
  getServerActionsManifest: () => ({ encryptionKey: mockEncryptionKey }),
  getServerModuleMap: () => ({}),
}))

jest.mock('./dynamic-rendering', () => ({
  createHangingInputAbortSignal: () => mockHangingInputController?.signal,
}))

const ACTION_ID = 'action-id'

describe('encryptActionBoundArgs', () => {
  type EncryptionMod = typeof import('./encryption')
  type WSMod = typeof import('./work-unit-async-storage.external')

  let encryptActionBoundArgs: EncryptionMod['encryptActionBoundArgs']
  let workUnitAsyncStorage: WSMod['workUnitAsyncStorage']

  beforeAll(() => {
    // 'async-local-storage.ts' needs `AsyncLocalStorage` on `globalThis` at
    // import time.
    // @ts-expect-error
    globalThis.AsyncLocalStorage = AsyncLocalStorage
  })

  beforeEach(() => {
    // The encryption key is cached in module scope, so each test needs fresh
    // modules to pick up `mockEncryptionKey`.
    jest.resetModules()
    workUnitAsyncStorage = (
      require('./work-unit-async-storage.external') as WSMod
    ).workUnitAsyncStorage
    encryptActionBoundArgs = (require('./encryption') as EncryptionMod)
      .encryptActionBoundArgs

    mockEncryptionKey = Buffer.from(
      crypto.getRandomValues(new Uint8Array(32))
    ).toString('base64')
    mockHangingInputController = undefined
  })

  function encryptInPrerender(resumeDataCache: ResumeDataCache) {
    const cacheSignal = new CacheSignal(null)
    const workUnitStore = {
      type: 'prerender',
      cacheSignal,
      resumeDataCache,
    } as unknown as WorkUnitStore

    const promise = workUnitAsyncStorage.run(workUnitStore, () =>
      encryptActionBoundArgs(ACTION_ID, 'bound', { arg: 1 })
    )

    return { promise, cacheSignal }
  }

  async function expectReadsSettled(cacheSignal: CacheSignal) {
    expect(cacheSignal.hasPendingReads()).toBe(false)
    // Renders with a cache signal wait for this before they continue.
    await cacheSignal.cacheReady()
  }

  async function prerenderEncryptedBoundArgs() {
    const resumeDataCache = createPrerenderResumeDataCache()
    const { promise, cacheSignal } = encryptInPrerender(resumeDataCache)
    const encrypted = await promise

    expect(resumeDataCache.encryptedBoundArgs.size).toBe(1)
    await expectReadsSettled(cacheSignal)

    return { encrypted, resumeDataCache }
  }

  it.each<[string, (source: ResumeDataCache) => ResumeDataCache]>([
    ['a mutable', createPrerenderResumeDataCache],
    ['an immutable', createRenderResumeDataCache],
  ])(
    'ends the cache read when reusing the encrypted bound args from %s resume data cache',
    async (_, createResumeDataCache) => {
      const prerender = await prerenderEncryptedBoundArgs()

      const { promise, cacheSignal } = encryptInPrerender(
        createResumeDataCache(prerender.resumeDataCache)
      )

      // A fresh encryption uses a random IV, so an identical string means the
      // cached value was returned.
      await expect(promise).resolves.toBe(prerender.encrypted)
      await expectReadsSettled(cacheSignal)
    }
  )

  it('ends the cache read started by the hanging input signal on a cache hit', async () => {
    const prerender = await prerenderEncryptedBoundArgs()

    const hangingInputController = new AbortController()
    mockHangingInputController = hangingInputController
    const { promise, cacheSignal } = encryptInPrerender(
      createPrerenderResumeDataCache(prerender.resumeDataCache)
    )

    await expect(promise).resolves.toBe(prerender.encrypted)
    expect(hangingInputController.signal.aborted).toBe(true)
    await expectReadsSettled(cacheSignal)
  })

  it('ends the cache read when encrypting the bound args fails', async () => {
    mockEncryptionKey = undefined

    const resumeDataCache = createPrerenderResumeDataCache()
    const { promise, cacheSignal } = encryptInPrerender(resumeDataCache)

    await expect(promise).rejects.toThrow(
      'Missing encryption key for Server Actions'
    )
    expect(resumeDataCache.encryptedBoundArgs.size).toBe(0)
    await expectReadsSettled(cacheSignal)
  })
})
