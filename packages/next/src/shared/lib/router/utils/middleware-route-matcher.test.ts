import type { BaseNextRequest } from '../../../../server/base-http'
import type { ProxyMatcher } from '../../../../build/analysis/get-page-static-info'
import type { Params } from '../../../../server/request/params'
import { getMiddlewareRouteMatcher } from './middleware-route-matcher'
import { matchHas } from './prepare-destination'

function createRequest(headers: Record<string, string> = {}) {
  return { headers } as unknown as BaseNextRequest
}

// The matcher as it behaved before compiled regexps were reused: a fresh
// RegExp for every matcher on every call.
function referenceMatch(
  matchers: ProxyMatcher[],
  pathname: string | null | undefined,
  req: BaseNextRequest,
  query: Params
): boolean {
  for (const matcher of matchers) {
    if (!new RegExp(matcher.regexp).exec(pathname!)) {
      continue
    }
    if (
      (matcher.has || matcher.missing) &&
      !matchHas(req, query, matcher.has, matcher.missing)
    ) {
      continue
    }
    return true
  }
  return false
}

// Counts `new RegExp(source)` calls whose source is one of `sources`, so
// RegExps built elsewhere (e.g. by `matchHas`) are ignored.
function countRegExpConstructions(sources: string[], fn: () => void): number {
  const OriginalRegExp = globalThis.RegExp
  let count = 0
  globalThis.RegExp = new Proxy(OriginalRegExp, {
    construct(target, args) {
      if (sources.includes(args[0])) {
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

describe('getMiddlewareRouteMatcher', () => {
  const matchers: ProxyMatcher[] = [
    // docs-style matcher that excludes api/_next/static/_next/image
    {
      regexp:
        '^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/((?!api|_next\\/static|_next\\/image|favicon.ico).*))(\\.json)?[\\/#\\?]?$',
      originalSource: '/((?!api|_next/static|_next/image|favicon.ico).*)',
    },
    {
      regexp: '^/api/with-header(?:/(.*))?$',
      originalSource: '/api/with-header/:path*',
      has: [{ type: 'header', key: 'x-foo', value: 'ba(?<suffix>r|z)' }],
    },
    {
      regexp: '^/api/without-cookie$',
      originalSource: '/api/without-cookie',
      missing: [{ type: 'cookie', key: 'session' }],
    },
    {
      regexp: '^/api/with-query$',
      originalSource: '/api/with-query',
      has: [{ type: 'query', key: 'preview' }],
    },
  ]

  it('returns the same results as compiling every regexp on every call', () => {
    const pathnames: Array<string | null | undefined> = [
      '/',
      '/about',
      '/blog/hello-world',
      '/_next/data/build-id/index.json',
      '/api',
      '/api/hello',
      '/api/with-header',
      '/api/with-header/a/b',
      '/api/without-cookie',
      '/api/with-query',
      '/_next/static/chunks/main.js',
      '/_next/image',
      '/favicon.ico',
      '/caf%C3%A9',
      '/café',
      '',
      null,
      undefined,
    ]
    const requests = [
      createRequest(),
      createRequest({ 'x-foo': 'bar' }),
      createRequest({ 'x-foo': 'qux' }),
      createRequest({ cookie: 'session=1' }),
    ]
    const queries: Params[] = [{}, { preview: '1' }]

    const match = getMiddlewareRouteMatcher(matchers)

    // Repeat to make sure reusing compiled regexps keeps no state between
    // calls.
    let compared = 0
    for (let round = 0; round < 3; round++) {
      for (const pathname of pathnames) {
        for (const req of requests) {
          for (const query of queries) {
            expect({
              pathname,
              headers: req.headers,
              query,
              matched: match(pathname, req, query),
            }).toEqual({
              pathname,
              headers: req.headers,
              query,
              matched: referenceMatch(matchers, pathname, req, query),
            })
            compared++
          }
        }
      }
    }
    expect(compared).toBe(3 * pathnames.length * requests.length * 2)

    const req = createRequest()
    expect(match('/about', req, {})).toBe(true)
    expect(match('/api/hello', req, {})).toBe(false)
    expect(
      match('/api/with-header', createRequest({ 'x-foo': 'baz' }), {})
    ).toBe(true)
    expect(match('/api/with-header', req, {})).toBe(false)
    expect(match('/api/without-cookie', req, {})).toBe(true)
    expect(
      match('/api/without-cookie', createRequest({ cookie: 'session=1' }), {})
    ).toBe(false)
    expect(match('/api/with-query', req, { preview: '1' })).toBe(true)
    expect(match('/api/with-query', req, {})).toBe(false)
  })

  it('compiles each matcher regexp once and reuses it across calls', () => {
    const simpleMatchers: ProxyMatcher[] = [
      { regexp: '^/a(?:/.*)?$', originalSource: '/a/:p*' },
      { regexp: '^/b$', originalSource: '/b' },
      {
        regexp: '^/c$',
        originalSource: '/c',
        has: [{ type: 'header', key: 'x-foo' }],
      },
    ]
    const match = getMiddlewareRouteMatcher(simpleMatchers)
    const results: boolean[][] = []

    const count = countRegExpConstructions(
      simpleMatchers.map((m) => m.regexp),
      () => {
        for (let i = 0; i < 10; i++) {
          results.push([
            match('/a/x', createRequest(), {}),
            match('/b', createRequest(), {}),
            match('/c', createRequest(), {}),
            match('/c', createRequest({ 'x-foo': '1' }), {}),
            match('/d', createRequest(), {}),
          ])
        }
      }
    )

    expect(results).toEqual(
      Array.from({ length: 10 }, () => [true, true, false, true, false])
    )
    expect(count).toBe(simpleMatchers.length)
  })

  it('only compiles a matcher regexp once it is reached', () => {
    const lazyMatchers: ProxyMatcher[] = [
      { regexp: '^/a$', originalSource: '/a' },
      { regexp: '^/b$', originalSource: '/b' },
    ]
    const match = getMiddlewareRouteMatcher(lazyMatchers)

    expect(
      countRegExpConstructions(['^/a$', '^/b$'], () => {
        expect(match('/a', createRequest(), {})).toBe(true)
        expect(match('/a', createRequest(), {})).toBe(true)
      })
    ).toBe(1)
  })

  it('throws for an invalid regexp on every call that reaches it', () => {
    const invalidMatchers: ProxyMatcher[] = [
      { regexp: '^/ok$', originalSource: '/ok' },
      { regexp: '^/(unclosed$', originalSource: '/(unclosed' },
    ]

    // Creating the matcher does not compile anything.
    const match = getMiddlewareRouteMatcher(invalidMatchers)

    expect(match('/ok', createRequest(), {})).toBe(true)
    expect(() => match('/other', createRequest(), {})).toThrow(SyntaxError)
    expect(() => match('/other', createRequest(), {})).toThrow(SyntaxError)
    expect(match('/ok', createRequest(), {})).toBe(true)
  })

  it('uses the updated regexp when a matcher is changed in place', () => {
    const mutableMatchers: ProxyMatcher[] = [
      { regexp: '^/before$', originalSource: '/before' },
    ]
    const match = getMiddlewareRouteMatcher(mutableMatchers)

    expect(match('/before', createRequest(), {})).toBe(true)
    expect(match('/after', createRequest(), {})).toBe(false)

    mutableMatchers[0].regexp = '^/after$'
    expect(match('/before', createRequest(), {})).toBe(false)
    expect(match('/after', createRequest(), {})).toBe(true)

    mutableMatchers.push({ regexp: '^/added$', originalSource: '/added' })
    expect(match('/added', createRequest(), {})).toBe(true)
  })
})
