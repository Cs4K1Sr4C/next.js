import { NextURL } from './next-url'
import {
  normalizeNextQueryParam,
  normalizeNextQueryParams,
  toNodeOutgoingHttpHeaders,
} from './utils'

describe('toNodeHeaders', () => {
  it('should handle multiple set-cookie headers correctly', () => {
    const headers = new Headers()

    headers.append('set-cookie', 'foo=bar')
    headers.append('set-cookie', 'bar=foo')

    expect(toNodeOutgoingHttpHeaders(headers)).toEqual({
      'set-cookie': ['foo=bar', 'bar=foo'],
    })
  })

  it('should handle a single set-cookie header correctly', () => {
    const headers = new Headers()

    headers.append('set-cookie', 'foo=bar')

    expect(toNodeOutgoingHttpHeaders(headers)).toEqual({
      'set-cookie': 'foo=bar',
    })
  })

  it('should handle a single set-cookie header with multiple cookies correctly', () => {
    const headers = new Headers()

    headers.append('set-cookie', 'foo=bar, bar=foo')

    expect(toNodeOutgoingHttpHeaders(headers)).toEqual({
      'set-cookie': ['foo=bar', 'bar=foo'],
    })

    headers.append('set-cookie', 'baz=qux')

    expect(toNodeOutgoingHttpHeaders(headers)).toEqual({
      'set-cookie': ['foo=bar', 'bar=foo', 'baz=qux'],
    })
  })

  it('should handle mixed case set-cookie headers correctly', () => {
    const headers = new Headers()

    headers.append('set-cookie', 'foo=bar')
    headers.append('Set-Cookie', 'bar=foo')

    expect(toNodeOutgoingHttpHeaders(headers)).toEqual({
      'set-cookie': ['foo=bar', 'bar=foo'],
    })
  })
})

describe('normalizeNextQueryParams', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  // The loop that adapter() used to run inline, kept verbatim as the
  // reference for the expected output.
  function reference(url: URL | NextURL) {
    const keys = [...url.searchParams.keys()]
    for (const key of keys) {
      const value = url.searchParams.getAll(key)

      const normalizedKey = normalizeNextQueryParam(key)
      if (normalizedKey) {
        url.searchParams.delete(normalizedKey)
        for (const val of value) {
          url.searchParams.append(normalizedKey, val)
        }
        url.searchParams.delete(key)
      }
    }
  }

  function expectSameAsReference(input: string) {
    for (const create of [
      (href: string) => new URL(href),
      (href: string) => new NextURL(href),
    ]) {
      const expected = create(input)
      reference(expected)
      const actual = create(input)
      normalizeNextQueryParams(actual)

      expect({ input, href: actual.href }).toEqual({
        input,
        href: expected.href,
      })
      expect(actual.search).toBe(expected.search)
      expect(actual.hash).toBe(expected.hash)
      expect([...actual.searchParams]).toEqual([...expected.searchParams])
    }
  }

  it.each([
    '',
    '?',
    '?a&a',
    '?a=1&b=2',
    '?nxtPslug=a&b=1',
    '?nxtPa=1&a=2',
    '?a=2&nxtPa=1',
    '?nxtPa=1&nxtIa=2',
    '?nxtIa=2&nxtPa=1',
    '?nxtPslug=1&nxtPslug=2',
    '?nxtPnxtPa=1&nxtPa=2',
    '?nxtPa=1&nxtPnxtPa=2',
    '?nxtPnxtInxtPa=1&nxtInxtPa=2&a=3',
    '?b=1&nxtPa=x&c=2&nxtPa=y&a=z',
    '?nxtP=1&nxtI=2',
    '?nxtP&nxtPa',
    '?nxtPa',
    '?nxtPa=1&&b=2&=3',
    '?nxtPa=1+2&b=%20x+y',
    '?nxtPa=%F0%9F%98%80&b=\u{1F600}',
    '?nxtPa=%zz&b=%',
    '?nxtPa=\'"<>&b=`{}|',
    '?nxtPa=1#hash',
    '?a&a#nxtPa=1',
  ])('matches the previous loop for %j', (query) => {
    expectSameAsReference('http://n/path' + query)
  })

  it('matches the previous loop for generated queries', () => {
    const keys = [
      'a',
      'b',
      '',
      'nxtP',
      'nxtI',
      'nxtPa',
      'nxtIa',
      'nxtPb',
      'nxtPnxtPa',
      'nxtInxtPa',
      'nxtPnxtIa',
      'nxtPnxtPnxtPa',
    ]
    const values = ['', '1', '2', '+', '%20', '%zz', '\u{1F600}', "'"]
    // Deterministic LCG so failures are reproducible.
    let seed = 1
    const random = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648
      return seed % n
    }

    for (let i = 0; i < 3000; i++) {
      const pairs: string[] = []
      for (let j = random(8); j > 0; j--) {
        const key = keys[random(keys.length)]
        pairs.push(
          random(4) === 0 ? key : `${key}=${values[random(values.length)]}`
        )
      }
      const hash = random(5) === 0 ? '#h' : ''
      expectSameAsReference(`http://n/?${pairs.join('&')}${hash}`)
    }
  })

  it('does not touch a query without prefixed keys', () => {
    // A large query of repeated keys must not cost a getAll() per key.
    const search = '?' + Array(7000).fill('a').join('&')
    const url = new URL('http://n/' + search)
    const getAll = jest.spyOn(URLSearchParams.prototype, 'getAll')
    const setSearch = jest.spyOn(URL.prototype, 'search', 'set')

    normalizeNextQueryParams(url)

    expect(getAll).not.toHaveBeenCalled()
    expect(setSearch).not.toHaveBeenCalled()
    expect(url.search).toBe(search)
  })

  it.each([
    {
      name: 'distinct prefixed keys',
      query: Array.from({ length: 1700 }, (_, i) => `nxtP${i}=${i}`),
      expected: Array.from({ length: 1700 }, (_, i) => `${i}=${i}`),
    },
    {
      name: 'repeated prefixed keys',
      query: Array.from({ length: 2600 }, (_, i) => `nxtPa=${i}`),
      // The second `nxtPa` deletes the `a` values the first one appended.
      expected: [],
    },
  ])('serializes the URL once for $name', ({ query, expected }) => {
    const url = new URL('http://n/?' + query.join('&'))
    const live = url.searchParams
    const getAll = jest.spyOn(URLSearchParams.prototype, 'getAll')
    const mutations = (['append', 'delete', 'set', 'sort'] as const).map(
      (method) => jest.spyOn(URLSearchParams.prototype, method)
    )
    const setSearch = jest.spyOn(URL.prototype, 'search', 'set')

    normalizeNextQueryParams(url)

    // getAll() scans the whole list, and each mutation of the URL's own
    // searchParams re-serializes the whole query, so either one per key
    // makes the normalization quadratic.
    expect(getAll).not.toHaveBeenCalled()
    for (const mutation of mutations) {
      expect(mutation.mock.contexts.filter((self) => self === live)).toEqual([])
    }
    expect(setSearch).toHaveBeenCalledTimes(1)
    expect(url.search).toBe(expected.length ? '?' + expected.join('&') : '')
    expect(url.searchParams).toBe(live)
  })
})
