/* eslint-env jest */
import { ImageOptimizerCache } from 'next/dist/server/image-optimizer'

type CacheKeyParams = Parameters<typeof ImageOptimizerCache.getCacheKey>[0]

const base: CacheKeyParams = {
  href: '/api/avatar/1',
  width: 2048,
  quality: 75,
  mimeType: 'image/webp',
}

describe('ImageOptimizerCache.getCacheKey', () => {
  it('returns the same key for the same params', () => {
    expect(ImageOptimizerCache.getCacheKey({ ...base })).toBe(
      ImageOptimizerCache.getCacheKey({ ...base })
    )
  })

  it('returns a base64url key that is safe to use as a directory name', () => {
    expect(ImageOptimizerCache.getCacheKey(base)).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('does not collide when trailing href digits run into the width', () => {
    // With the default config, 2048 is a device size and 48 is an image size,
    // and "2048" === "20" + "48".
    const victim = ImageOptimizerCache.getCacheKey({
      href: '/api/avatar/1',
      width: 2048,
      quality: 75,
      mimeType: 'image/webp',
    })
    const attacker = ImageOptimizerCache.getCacheKey({
      href: '/api/avatar/120',
      width: 48,
      quality: 75,
      mimeType: 'image/webp',
    })
    expect(victim).not.toBe(attacker)
  })

  it('does not collide when trailing remote href digits run into the width', () => {
    expect(
      ImageOptimizerCache.getCacheKey({
        ...base,
        href: 'https://cdn.example.com/avatars/1',
        width: 2048,
      })
    ).not.toBe(
      ImageOptimizerCache.getCacheKey({
        ...base,
        href: 'https://cdn.example.com/avatars/120',
        width: 48,
      })
    )
  })

  it('does not collide when width digits run into the quality', () => {
    expect(
      ImageOptimizerCache.getCacheKey({ ...base, width: 64, quality: 75 })
    ).not.toBe(
      ImageOptimizerCache.getCacheKey({ ...base, width: 647, quality: 5 })
    )
  })

  it('does not collide when quality digits run into the mimeType', () => {
    expect(
      ImageOptimizerCache.getCacheKey({
        ...base,
        quality: 75,
        mimeType: 'image/webp',
      })
    ).not.toBe(
      ImageOptimizerCache.getCacheKey({
        ...base,
        quality: 7,
        mimeType: '5image/webp',
      })
    )
  })

  it('returns a distinct key for every distinct set of params', () => {
    const table: CacheKeyParams[] = []
    for (const href of [
      '/a',
      '/a1',
      '/a12',
      '/a/1',
      '/a/120',
      '/test.png?v=1',
      '/test.png?v=120',
      'https://example.com/a',
      'https://example.com/a20',
    ]) {
      for (const width of [48, 64, 640, 2048, 3840]) {
        for (const quality of [5, 50, 75, 100]) {
          for (const mimeType of ['image/webp', 'image/avif', 'image/png']) {
            table.push({ href, width, quality, mimeType })
          }
        }
      }
    }
    const keys = new Set(table.map((p) => ImageOptimizerCache.getCacheKey(p)))
    expect(keys.size).toBe(table.length)
  })
})
