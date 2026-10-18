import type { IncomingMessage } from 'http'
import type { RouteHas } from '../../../../lib/load-custom-routes'
import {
  compileNonPath,
  matchHas,
  parseDestination,
} from './prepare-destination'
import { safeCompile } from './route-match-utils'

jest.mock('./route-match-utils', () => {
  const actual = jest.requireActual('./route-match-utils')
  return { ...actual, safeCompile: jest.fn(actual.safeCompile) }
})

function createRequest(headers: Record<string, string | string[]> = {}) {
  return { headers } as unknown as IncomingMessage
}

// Counts `new RegExp(source)` calls whose source is `source`, so RegExps built
// elsewhere are ignored.
function countRegExpConstructions(source: string, fn: () => void): number {
  const OriginalRegExp = globalThis.RegExp
  let count = 0
  globalThis.RegExp = new Proxy(OriginalRegExp, {
    construct(target, args) {
      if (args[0] === source) {
        count++
      }
      return new target(...(args as [string]))
    },
  })
  try {
    fn()
  } finally {
    globalThis.RegExp = OriginalRegExp
  }
  return count
}

describe('parseDestination', () => {
  it('should parse the destination', () => {
    const destination = '/hello/:name'
    const params = { name: 'world' }
    const query = { foo: 'bar' }

    const result = parseDestination({
      destination,
      params,
      query,
    })

    expect(result).toMatchInlineSnapshot(`
     {
       "auth": null,
       "hash": "",
       "host": null,
       "hostname": null,
       "href": "/hello/:name",
       "origin": undefined,
       "pathname": "/hello/:name",
       "port": null,
       "protocol": null,
       "query": {},
       "search": "",
       "slashes": null,
     }
    `)
  })

  it('should parse the destination with a hash', () => {
    const destination = 'https://o:foo.com/hello/:name#bar'
    const params = { name: 'world' }
    const query = { foo: 'bar' }

    const result = parseDestination({
      destination,
      params,
      query,
    })

    expect(result).toMatchInlineSnapshot(`
     {
       "auth": null,
       "hash": "#bar",
       "hostname": "o:foo.com",
       "href": "https://o:foo.com/hello/:name#bar",
       "origin": "https://o:foo.com",
       "pathname": "/hello/:name",
       "port": "",
       "protocol": "https:",
       "query": {},
       "search": "",
       "slashes": true,
     }
    `)
  })

  it('should parse the destination with a host', () => {
    const destination = 'https://o:foo.com/hello/:name?foo=:bar'
    const params = { name: 'world' }
    const query = { foo: 'bar' }

    const result = parseDestination({
      destination,
      params,
      query,
    })

    expect(result).toMatchInlineSnapshot(`
     {
       "auth": null,
       "hash": "",
       "hostname": "o:foo.com",
       "href": "https://o:foo.com/hello/:name?foo=:bar",
       "origin": "https://o:foo.com",
       "pathname": "/hello/:name",
       "port": "",
       "protocol": "https:",
       "query": {
         "foo": ":bar",
       },
       "search": "?foo=:bar",
       "slashes": true,
     }
    `)
  })
})

describe('matchHas', () => {
  it.each<{
    name: string
    headers?: Record<string, string | string[]>
    query?: Record<string, string | string[]>
    has?: RouteHas[]
    missing?: RouteHas[]
    expected: ReturnType<typeof matchHas>
  }>([
    {
      name: 'host with named group',
      headers: { host: 'shop.example.com:3000' },
      has: [{ type: 'host', value: '(?<sub>[^.]+)\\.example\\.com' }],
      expected: { sub: 'shop' },
    },
    {
      name: 'host with named group, different host',
      headers: { host: 'blog.example.com' },
      has: [{ type: 'host', value: '(?<sub>[^.]+)\\.example\\.com' }],
      expected: { sub: 'blog' },
    },
    {
      name: 'host not matching',
      headers: { host: 'other.com' },
      has: [{ type: 'host', value: '(?<sub>[^.]+)\\.example\\.com' }],
      expected: false,
    },
    {
      name: 'host without groups',
      headers: { host: 'Example.com' },
      has: [{ type: 'host', value: 'example\\.com' }],
      expected: { host: 'example.com' },
    },
    {
      name: 'header value is anchored',
      headers: { 'x-variant': 'ab' },
      has: [{ type: 'header', key: 'X-Variant', value: 'a' }],
      expected: false,
    },
    {
      name: 'header with value',
      headers: { 'x-variant': 'a' },
      has: [{ type: 'header', key: 'X-Variant', value: 'a|b' }],
      expected: {},
    },
    {
      name: 'header without value',
      headers: { 'x-my-header': 'hello' },
      has: [{ type: 'header', key: 'x-my-header' }],
      expected: { xmyheader: 'hello' },
    },
    {
      name: 'array header uses the last value',
      headers: { 'x-tag': ['first', 'second'] },
      has: [{ type: 'header', key: 'x-tag', value: '(?<tag>sec.*)' }],
      expected: { tag: 'second' },
    },
    {
      name: 'cookie with value',
      headers: { cookie: 'theme=dark; other=1' },
      has: [{ type: 'cookie', key: 'theme', value: '(?<theme>dark|light)' }],
      expected: { theme: 'dark' },
    },
    {
      name: 'query with value',
      query: { lang: 'en' },
      has: [{ type: 'query', key: 'lang', value: 'en|fr' }],
      expected: {},
    },
    {
      name: 'missing with matching value',
      headers: { 'x-variant': 'a' },
      missing: [{ type: 'header', key: 'x-variant', value: 'a' }],
      expected: false,
    },
    {
      name: 'missing with non-matching value',
      headers: { 'x-variant': 'b' },
      missing: [{ type: 'header', key: 'x-variant', value: 'a' }],
      expected: {},
    },
    {
      name: 'has and missing combined',
      headers: { host: 'shop.example.com', 'x-variant': 'b' },
      has: [{ type: 'host', value: '(?<sub>[^.]+)\\.example\\.com' }],
      missing: [{ type: 'header', key: 'x-variant', value: 'a' }],
      expected: { sub: 'shop' },
    },
  ])('$name', ({ headers, query, has, missing, expected }) => {
    // Run twice so a reused matcher must give the same result each time.
    for (let i = 0; i < 2; i++) {
      expect(
        matchHas(createRequest(headers), query ?? {}, has, missing)
      ).toEqual(expected)
    }
  })

  it('creates the RegExp for a `has` value once and reuses it', () => {
    const value = '(?<sub>[^.]+)\\.reuse-has-regex\\.example'
    const has: RouteHas[] = [{ type: 'host', value }]
    const results: ReturnType<typeof matchHas>[] = []

    const count = countRegExpConstructions(`^${value}$`, () => {
      for (const sub of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
        results.push(
          matchHas(
            createRequest({ host: `${sub}.reuse-has-regex.example` }),
            {},
            has
          )
        )
      }
    })

    expect(results).toEqual(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((sub) => ({
        sub,
      }))
    )
    expect(count).toBeLessThanOrEqual(1)
  })

  it('throws for an invalid `has` value on every call', () => {
    const has: RouteHas[] = [{ type: 'header', key: 'x-invalid', value: '(' }]
    for (let i = 0; i < 2; i++) {
      expect(() =>
        matchHas(createRequest({ 'x-invalid': 'a' }), {}, has)
      ).toThrow(SyntaxError)
    }
  })
})

describe('compileNonPath', () => {
  it.each<{
    value: string
    params: Record<string, string | string[]>
    expected: string
  }>([
    {
      value: 'https://:host.example.com/:path',
      params: { host: 'a', path: 'x' },
      expected: 'https://a.example.com/x',
    },
    {
      value: 'https://:host.example.com/:path',
      params: { host: 'b', path: 'y' },
      expected: 'https://b.example.com/y',
    },
    {
      value: 'https://:host.example.com/:path',
      params: { host: 'b' },
      expected: 'https://b.example.com/:path',
    },
    { value: '/:path*', params: { path: ['a', 'b'] }, expected: '/a/b' },
    { value: '/:path*', params: { path: ['c'] }, expected: '/c' },
    { value: '/:path+', params: { path: ['a', 'b'] }, expected: '/a/b' },
    { value: '/:path?', params: { path: 'a' }, expected: '/a' },
    {
      value: "default-src 'self'; img-src 'self' data: https:",
      params: { path: ['a'] },
      expected: "default-src 'self'; img-src 'self' data: https:",
    },
    {
      value: '</:path*>; rel=preload',
      params: { path: ['a', 'b'] },
      expected: '</a/b>; rel=preload',
    },
    {
      value: 'no-colon-here',
      params: { path: 'a' },
      expected: 'no-colon-here',
    },
    { value: ':a-:b', params: { a: 'x', b: 'y' }, expected: 'x-y' },
    { value: 'v=:id(.*)', params: { id: '1' }, expected: 'v=1(.*)' },
  ])('compiles $value with $params', ({ value, params, expected }) => {
    // Run twice so a reused compiler must give the same result each time.
    for (let i = 0; i < 2; i++) {
      expect(compileNonPath(value, params)).toBe(expected)
    }
  })

  it('compiles a value once and reuses it with per-call params', () => {
    const value = 'https://:host.compile-non-path-once.example/:path'
    const compileCalls = () =>
      jest
        .mocked(safeCompile)
        .mock.calls.filter(([route]) => route.includes('compile-non-path-once'))

    expect(compileCalls()).toHaveLength(0)
    expect(compileNonPath(value, { host: 'a', path: 'x' })).toBe(
      'https://a.compile-non-path-once.example/x'
    )
    expect(compileNonPath(value, { host: 'b', path: 'y' })).toBe(
      'https://b.compile-non-path-once.example/y'
    )
    expect(compileCalls()).toHaveLength(1)
  })

  it.each<{
    value: string
    params: Record<string, string | string[]>
    error: string
  }>([
    // thrown while compiling
    {
      value: ':a:b',
      params: { a: 'x', b: 'y' },
      error: 'Must have text between two parameters',
    },
    // thrown by the compiled function
    {
      value: '/:path',
      params: { path: ['a', 'b'] },
      error: 'Expected "path" to not repeat, but got an array',
    },
  ])(
    'throws for $value with $params on every call',
    ({ value, params, error }) => {
      for (let i = 0; i < 2; i++) {
        expect(() => compileNonPath(value, params)).toThrow(error)
      }
    }
  )
})
