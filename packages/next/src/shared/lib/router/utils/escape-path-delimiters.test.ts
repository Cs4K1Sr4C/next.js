import escapePathDelimiters from './escape-path-delimiters'

// The implementation that built a new RegExp on every call, kept here to prove
// the shared regexes produce identical output.
function referenceEscapePathDelimiters(
  segment: string,
  escapeEncoded?: boolean
): string {
  return segment.replace(
    new RegExp(`([/#?\\\\]${escapeEncoded ? '|%(2f|23|3f|5c)' : ''})`, 'gi'),
    (char: string) => encodeURIComponent(char)
  )
}

describe('escapePathDelimiters', () => {
  it('should escape path delimiters', () => {
    expect(escapePathDelimiters('a/b%2Fc')).toBe('a%2Fb%2Fc')
    expect(escapePathDelimiters('x?y#z\\w', false)).toBe('x%3Fy%23z%5Cw')
  })

  it('should also escape encoded path delimiters when escapeEncoded is set', () => {
    expect(escapePathDelimiters('a/b%2Fc', true)).toBe('a%2Fb%252Fc')
    expect(escapePathDelimiters('%2f%3F', true)).toBe('%252f%253F')
  })

  it('should keep no state between calls', () => {
    for (let i = 0; i < 2; i++) {
      expect(escapePathDelimiters('a/b%2Fc', true)).toBe('a%2Fb%252Fc')
      expect(escapePathDelimiters('a/b%2Fc', false)).toBe('a%2Fb%2Fc')
      expect(escapePathDelimiters('a/b%2Fc', true)).toBe('a%2Fb%252Fc')
      expect(escapePathDelimiters('a/b%2Fc')).toBe('a%2Fb%2Fc')
    }
  })

  it('should match the reference implementation', () => {
    const inputs = [
      '',
      'abc',
      '/',
      'a/b/c',
      'a/b%2Fc',
      'x?y#z\\w',
      '%2f%3F',
      '%2F%23%3F%5C',
      '%2f%23%3f%5c',
      '%5C%23/',
      '%%2f2f',
      '%2',
      '%25',
      '%20sticks & stones',
      '日本語/テスト?',
      '??##//\\\\',
    ]
    for (let i = 0; i < 2; i++) {
      for (const input of inputs) {
        for (const escapeEncoded of [true, false, undefined]) {
          expect(escapePathDelimiters(input, escapeEncoded)).toBe(
            referenceEscapePathDelimiters(input, escapeEncoded)
          )
        }
      }
    }
  })

  it('should reuse the same regex across calls', () => {
    const replaceSpy = jest.spyOn(String.prototype, 'replace')
    let patterns: unknown[]
    try {
      escapePathDelimiters('a/b', true)
      escapePathDelimiters('c?d', true)
      escapePathDelimiters('a/b', false)
      escapePathDelimiters('c?d')
      patterns = replaceSpy.mock.calls.map(([pattern]) => pattern)
    } finally {
      replaceSpy.mockRestore()
    }

    expect(patterns).toHaveLength(4)
    expect(patterns[0]).toBeInstanceOf(RegExp)
    expect(patterns[2]).toBeInstanceOf(RegExp)
    expect(patterns[1]).toBe(patterns[0])
    expect(patterns[3]).toBe(patterns[2])
    expect(patterns[2]).not.toBe(patterns[0])
  })
})
