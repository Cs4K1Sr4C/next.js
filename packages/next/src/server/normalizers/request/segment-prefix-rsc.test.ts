import { SegmentPrefixRSCPathnameNormalizer } from './segment-prefix-rsc'

describe('SegmentPrefixRSCPathnameNormalizer', () => {
  it('should match and extract the original pathname and segment path', () => {
    const normalizer = new SegmentPrefixRSCPathnameNormalizer()
    const result = normalizer.extract('/hello/hello.segments/_tree.segment.rsc')
    expect(result).toEqual({
      originalPathname: '/hello/hello',
      segmentPath: '/_tree',
    })
  })

  it('should extract segment prefetch paths for catch-all params named segments', () => {
    const normalizer = new SegmentPrefixRSCPathnameNormalizer()
    const result = normalizer.extract(
      '/catch/[...segments].segments/catch/$c$segments/__PAGE__.segment.rsc'
    )

    expect(result).toEqual({
      originalPathname: '/catch/[...segments]',
      segmentPath: '/catch/$c$segments/__PAGE__',
    })
  })

  it('should still extract segment prefetch paths for other catch-all param names', () => {
    const normalizer = new SegmentPrefixRSCPathnameNormalizer()
    const result = normalizer.extract(
      '/catch/[...foobar].segments/catch/$c$foobar/__PAGE__.segment.rsc'
    )

    expect(result).toEqual({
      originalPathname: '/catch/[...foobar]',
      segmentPath: '/catch/$c$foobar/__PAGE__',
    })
  })
})

describe('SegmentPrefixRSCPathnameNormalizer equivalence', () => {
  // The regex the normalizer used to match with. It backtracks quadratically
  // on pathnames with many `.segments/` occurrences, so the normalizer no
  // longer uses it, but it must still produce exactly the same results.
  const REFERENCE = /^(\/.*)\.segments(\/.*)\.segment\.rsc$/

  function reference(pathname: string) {
    const match = pathname.match(REFERENCE)
    if (!match) return null

    return { originalPathname: match[1], segmentPath: match[2] }
  }

  function expectSameAsReference(
    normalizer: SegmentPrefixRSCPathnameNormalizer,
    pathname: string
  ) {
    const expected = reference(pathname)
    expect({ pathname, result: normalizer.extract(pathname) }).toEqual({
      pathname,
      result: expected,
    })
    expect({ pathname, result: normalizer.match(pathname) }).toEqual({
      pathname,
      result: expected !== null,
    })
    expect({ pathname, result: normalizer.normalize(pathname) }).toEqual({
      pathname,
      result: expected ? expected.originalPathname : pathname,
    })
  }

  it.each([
    ['/.segments/.segment.rsc', { originalPathname: '/', segmentPath: '/' }],
    [
      '/x.segments/.segments/.segment.rsc',
      { originalPathname: '/x.segments/', segmentPath: '/' },
    ],
    [
      '/.segments.segments/.segment.rsc',
      { originalPathname: '/.segments', segmentPath: '/' },
    ],
    [
      '/a.segments/b.segments/c.segment.rsc',
      { originalPathname: '/a.segments/b', segmentPath: '/c' },
    ],
    [
      '/a.segments/.segment.rsc.segment.rsc',
      { originalPathname: '/a', segmentPath: '/.segment.rsc' },
    ],
    [
      '/a b.segments/c d.segment.rsc',
      { originalPathname: '/a b', segmentPath: '/c d' },
    ],
    ['', null],
    ['/', null],
    ['/.segment.rsc', null],
    ['/.segments.segment.rsc', null],
    ['/a.segments.segment.rsc', null],
    ['.segments/.segment.rsc', null],
    ['a/.segments/b.segment.rsc', null],
    ['/a.segments/b.segment.rs', null],
    ['/a.segments/b.segment.rsc ', null],
    ['/a.segments/b.segment.rsc/', null],
    ['/a\n.segments/b.segment.rsc', null],
    ['/a.segments/b\r.segment.rsc', null],
    ['/a\u2028.segments/b.segment.rsc', null],
    ['/a.segments/b\u2029.segment.rsc', null],
  ])('extract(%j) matches the reference regex', (pathname, expected) => {
    const normalizer = new SegmentPrefixRSCPathnameNormalizer()
    expect(reference(pathname)).toEqual(expected)
    expectSameAsReference(normalizer, pathname)
  })

  it('matches the reference regex for generated pathnames', () => {
    const normalizer = new SegmentPrefixRSCPathnameNormalizer()
    const pieces = [
      '/',
      '.',
      'x',
      's',
      ' ',
      '.segments',
      '.segments/',
      '.segment.rsc',
      '.segment',
      '.rsc',
      '/.segment.rsc',
      '\n',
      '\r',
      '\u2028',
      '\u2029',
      '\ud800',
    ]

    // Deterministic PRNG (mulberry32) so failures are reproducible.
    let seed = 0x5e9e47
    const random = () => {
      seed = (seed + 0x6d2b79f5) | 0
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    let matched = 0
    for (let i = 0; i < 20_000; i++) {
      let pathname = random() < 0.8 ? '/' : ''
      const count = Math.floor(random() * 8)
      for (let j = 0; j < count; j++) {
        pathname += pieces[Math.floor(random() * pieces.length)]
      }
      if (random() < 0.5) pathname += '.segment.rsc'

      if (reference(pathname)) matched++
      expectSameAsReference(normalizer, pathname)
    }

    // Make sure both outcomes were exercised.
    expect(matched).toBeGreaterThan(500)
    expect(matched).toBeLessThan(19_000)
  })

  it('handles pathnames with many `.segments/` occurrences in linear time', () => {
    const normalizer = new SegmentPrefixRSCPathnameNormalizer()
    const repeated = '.segments/'.repeat(6400)
    const miss = '/' + repeated + 'x'
    const hit = '/' + repeated + 'x.segment.rsc'

    // The former regex took hundreds of milliseconds on these inputs (it is
    // quadratic in the number of `.segments/` occurrences); a linear scan takes
    // well under a millisecond, so this bound is very loose.
    const start = performance.now()
    const missMatch = normalizer.match(miss)
    const missExtract = normalizer.extract(miss)
    const hitMatch = normalizer.match(hit)
    const hitExtract = normalizer.extract(hit)
    const elapsed = performance.now() - start

    expect(missMatch).toBe(false)
    expect(missExtract).toBeNull()
    expect(hitMatch).toBe(true)
    expect(hitExtract).toEqual({
      originalPathname: '/' + '.segments/'.repeat(6399),
      segmentPath: '/x',
    })
    expect(elapsed).toBeLessThan(50)
  })
})
