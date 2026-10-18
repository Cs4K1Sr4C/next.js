/* eslint-env jest */
import { ImageOptimizerCache } from 'next/dist/server/image-optimizer'
import { imageConfigDefault } from 'next/dist/shared/lib/image-config'

const nextConfig = { images: { ...imageConfigDefault }, basePath: '' } as any
const req = { headers: { accept: 'image/webp' } } as any

const validate = (url: string) =>
  ImageOptimizerCache.validateParams(
    req,
    { url, w: '64', q: '75' },
    nextConfig,
    false
  )

describe('ImageOptimizerCache.validateParams', () => {
  it.each(['/%', '/foo%', '/%E0%A4%A', '/images/100%.png', '/%zz.png'])(
    'returns an error instead of throwing for malformed percent-encoding in %s',
    (url) => {
      expect(validate(url)).toEqual({
        errorMessage: '"url" parameter is invalid',
      })
    }
  )

  it.each([
    '/_next/image?url=/a.png',
    '/_next/image/foo',
    '/%5Fnext/image?url=/a.png',
    '/%5Fnext%2Fimage?url=/a.png',
    '/docs/_next/image?url=/a.png',
  ])('still rejects the recursive url %s', (url) => {
    expect(validate(url)).toEqual({
      errorMessage: '"url" parameter cannot be recursive',
    })
  })

  it.each(['/test.png', '/images/100%25.png', '/caf%C3%A9.png', '/a.png?v=1'])(
    'still accepts the local url %s',
    (url) => {
      expect(validate(url)).toEqual({
        href: url,
        sizes: [
          ...imageConfigDefault.deviceSizes,
          ...imageConfigDefault.imageSizes,
        ],
        isAbsolute: false,
        isStatic: false,
        width: 64,
        quality: 75,
        mimeType: 'image/webp',
        minimumCacheTTL: imageConfigDefault.minimumCacheTTL,
      })
    }
  )
})
