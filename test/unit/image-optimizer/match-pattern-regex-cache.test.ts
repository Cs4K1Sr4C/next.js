/* eslint-env jest */
import type {
  LocalPattern,
  RemotePattern,
} from 'next/dist/shared/lib/image-config'
import {
  matchRemotePattern,
  hasRemoteMatch,
} from 'next/dist/shared/lib/match-remote-pattern'
import {
  matchLocalPattern,
  hasLocalMatch,
} from 'next/dist/shared/lib/match-local-pattern'

jest.mock('next/dist/compiled/picomatch', () => {
  const actual = jest.requireActual('next/dist/compiled/picomatch')
  return { ...actual, makeRe: jest.fn(actual.makeRe) }
})

const { makeRe: makeReMock } = jest.requireMock<
  typeof import('next/dist/compiled/picomatch')
>('next/dist/compiled/picomatch')

// The compiled globs are cached at module level for the whole test file, so
// each test that counts makeRe() calls uses globs no earlier test compiles.
describe('match pattern RegExp cache', () => {
  beforeEach(() => {
    jest.mocked(makeReMock).mockClear()
  })

  it('keeps hostname and pathname globs apart', () => {
    // `**` is compiled for the hostname without `dot` first. The pathname
    // default `**` must still be compiled with `{ dot: true }`.
    const p = { hostname: '**', pathname: '**' }
    const url = new URL('https://a.example.com/.well-known/a.png')
    expect(matchRemotePattern(p, url)).toBe(true)
    expect(matchRemotePattern(p, url)).toBe(true)
    expect(makeReMock).toHaveBeenCalledTimes(2)
    expect(makeReMock).toHaveBeenNthCalledWith(1, '**')
    expect(makeReMock).toHaveBeenNthCalledWith(2, '**', { dot: true })
  })

  it('compiles remote pattern globs once across requests', () => {
    const patterns = [
      { hostname: 'other.example.com' },
      { hostname: 'cdn.example.com', pathname: '/img/**' },
    ]
    const url = new URL('https://cdn.example.com/img/a.png')
    expect(hasRemoteMatch([], patterns, url)).toBe(true)
    expect(hasRemoteMatch([], patterns, url)).toBe(true)
    expect(hasRemoteMatch([], patterns, url)).toBe(true)
    expect(makeReMock).toHaveBeenCalledTimes(3)
    expect(makeReMock).toHaveBeenNthCalledWith(1, 'other.example.com')
    expect(makeReMock).toHaveBeenNthCalledWith(2, 'cdn.example.com')
    expect(makeReMock).toHaveBeenNthCalledWith(3, '/img/**', { dot: true })

    jest.mocked(makeReMock).mockClear()
    expect(
      hasRemoteMatch([], patterns, new URL('https://cdn.example.com/x.png'))
    ).toBe(false)
    expect(makeReMock).not.toHaveBeenCalled()
  })

  it('compiles local pattern globs once across requests', () => {
    const patterns = [{ pathname: '/static-cache/**' }]
    expect(hasLocalMatch(patterns, '/static-cache/a.png')).toBe(true)
    expect(hasLocalMatch(patterns, '/static-cache/a.png')).toBe(true)
    expect(hasLocalMatch(patterns, '/other/a.png')).toBe(false)
    expect(makeReMock).toHaveBeenCalledTimes(1)
    expect(makeReMock).toHaveBeenCalledWith('/static-cache/**', { dot: true })
  })

  it('still throws on every call for an invalid glob', () => {
    const url = new URL('https://example.com/a.png')
    expect(() => matchRemotePattern({ hostname: '' }, url)).toThrow()
    expect(() => matchRemotePattern({ hostname: '' }, url)).toThrow()
    expect(() =>
      matchRemotePattern({ hostname: 'example.com', pathname: '' }, url)
    ).toThrow()
    expect(() =>
      matchRemotePattern({ hostname: 'example.com', pathname: '' }, url)
    ).toThrow()
    expect(() => matchLocalPattern({ pathname: '' }, url)).toThrow()
    expect(() => matchLocalPattern({ pathname: '' }, url)).toThrow()
  })

  it('returns the same results as before for remote patterns', () => {
    const cases: Array<[RemotePattern, string, boolean]> = [
      [{ hostname: 'example.com' }, 'https://example.com/a.png', true],
      [{ hostname: 'example.com' }, 'https://example.org/a.png', false],
      [{ hostname: 'example.com' }, 'https://example.com/.dot/a.png', true],
      [{ hostname: '*.example.com' }, 'https://img.example.com/a.png', true],
      [{ hostname: '*.example.com' }, 'https://example.com/a.png', false],
      [{ hostname: '**.example.com' }, 'https://a.img.example.com/a', true],
      [
        { hostname: 'example.com', pathname: '/images/**' },
        'https://example.com/images/a/b.png',
        true,
      ],
      [
        { hostname: 'example.com', pathname: '/images/**' },
        'https://example.com/images/.hidden/b.png',
        true,
      ],
      [
        { hostname: 'example.com', pathname: '/images/**' },
        'https://example.com/other/b.png',
        false,
      ],
      [
        { hostname: 'example.com', pathname: '/uploads/**/*.png' },
        'https://example.com/uploads/x/y.png',
        true,
      ],
      [
        { hostname: 'example.com', pathname: '/uploads/**/*.png' },
        'https://example.com/uploads/x/y.jpg',
        false,
      ],
      [
        {
          protocol: 'https',
          hostname: 'example.com',
          port: '',
          search: '?v=1',
        },
        'https://example.com/a.png?v=1',
        true,
      ],
      [
        {
          protocol: 'https',
          hostname: 'example.com',
          port: '',
          search: '?v=1',
        },
        'https://example.com/a.png?v=2',
        false,
      ],
      [
        { protocol: 'https', hostname: 'example.com', port: '' },
        'https://example.com:81/a.png',
        false,
      ],
    ]
    // Each case runs more than once so a reused RegExp is also exercised.
    for (let i = 0; i < 3; i++) {
      for (const [p, url, expected] of cases) {
        expect([p, url, matchRemotePattern(p, new URL(url))]).toEqual([
          p,
          url,
          expected,
        ])
      }
    }
  })

  it('returns the same results as before for local patterns', () => {
    const cases: Array<[LocalPattern, string, boolean]> = [
      [{}, '/.well-known/a', true],
      [{ pathname: '/assets/**' }, '/assets/a/b.png', true],
      [{ pathname: '/assets/**' }, '/assets/.x/b.png', true],
      [{ pathname: '/assets/**' }, '/other/b.png', false],
      [{ pathname: '/assets/**', search: '' }, '/assets/a.png?v=1', false],
      [{ pathname: '/assets/*.png' }, '/assets/a.png', true],
      [{ pathname: '/assets/*.png' }, '/assets/a/b.png', false],
    ]
    for (let i = 0; i < 3; i++) {
      for (const [p, url, expected] of cases) {
        expect([
          p,
          url,
          matchLocalPattern(p, new URL(url, 'http://n')),
        ]).toEqual([p, url, expected])
      }
    }
  })
})
