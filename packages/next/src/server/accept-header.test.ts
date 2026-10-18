import { acceptLanguage } from './accept-header'

describe('acceptLanguage wildcards', () => {
  it.each([
    // [header, preferences, expected]
    ['*', undefined, '*'],
    ['*, *', undefined, '*'],
    ['*', ['en-US'], 'en-US'],
    ['*,*', ['de', 'en'], 'de'],
    ['da, en-GB, *', ['en-US'], 'en-US'],
    ['da, en-GB, *, *', ['en-US'], 'en-US'],
    ['*;q=0.5, fr, *', ['en-US', 'fr'], 'fr'],
    ['*;q=0.5, fr;q=0.8, *;q=0.1', ['de', 'fr'], 'fr'],
    ['*, fr;q=0.5, *;q=0.1', ['de', 'fr'], 'de'],
    ['*, en;q=0', ['en-US', 'fr'], 'en-US'],
    ['*, en-US;q=0, en;q=0', ['en-US', 'fr'], 'fr'],
    ['*;q=0, *', ['en-US'], 'en-US'],
    ['*;q=0, *;q=0', ['en-US'], ''],
    ['en-US, *, *', ['en-US'], 'en-US'],
    ['en-us;q=0, en;q=0, *, *', ['en-US'], ''],
    ['en-us;q=0, *, *, da', ['en-US', 'da'], 'da'],
    ['en-us;q=0, en;q=0, *, *, da;q=0.5', ['en-US', 'da'], 'da'],
    ['da;q=0.5, *, *', ['da', 'en-GB'], 'en-GB'],
    ['da, *;q=0.9, *;q=0.9', ['en-GB', 'da'], 'da'],
    ['xx, *, yy, *', ['de-AT', 'de'], 'de-AT'],
  ] as const)(
    'acceptLanguage(%j, %j) === %j',
    (header, preferences, expected) => {
      expect(acceptLanguage(header, preferences)).toBe(expected)
    }
  )

  it('does not re-expand the preferences for every repeated wildcard', () => {
    const locales = Array.from({ length: 100 }, (_, i) => `l${i}-R${i % 7}`)
    const stars = 7000
    const header = Array(stars).fill('*').join(',')

    // Count array pushes made while matching, as a deterministic measure of
    // the work done. Expanding every `*` costs `stars` times the number of
    // locales and locale prefixes.
    const originalPush = Array.prototype.push
    let pushes = 0
    let result: string | undefined
    // eslint-disable-next-line no-extend-native
    Array.prototype.push = function (this: unknown[], ...items: unknown[]) {
      pushes++
      return originalPush.apply(this, items)
    }
    try {
      result = acceptLanguage(header, locales)
    } finally {
      // eslint-disable-next-line no-extend-native
      Array.prototype.push = originalPush
    }

    expect(result).toBe('l0-R0')
    expect(pushes).toBeLessThan(stars + 10 * locales.length)
  })
})
