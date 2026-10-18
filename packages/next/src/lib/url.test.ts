import { parseReqUrl } from './url'

function forInKeys(obj: object): string[] {
  const keys: string[] = []
  for (const key in obj) keys.push(key)
  return keys
}

describe('parseReqUrl', () => {
  it.each([
    ['/', {}],
    ['/a?x=1', { x: '1' }],
    ['/a?x=1&y=2&x=3', { x: ['1', '3'], y: '2' }],
    ['/a?x=&y', { x: '', y: '' }],
    ['/a?constructor=1&toString=2', { constructor: '1', toString: '2' }],
  ])('parses the query of %j', (url, expected) => {
    const parsed = parseReqUrl(url)!
    expect(parsed.query).toEqual(expected)
    expect(Object.getPrototypeOf(parsed.query)).toBe(Object.prototype)
  })

  it('does not replace the query prototype via __proto__', () => {
    for (const url of [
      '/a?__proto__=x&b=1',
      '/a?__proto__=x&__proto__=y&b=1',
      '/a?b=1&__proto__=x&__proto__=y&__proto__=z',
    ]) {
      const { query } = parseReqUrl(url)!
      expect(Object.getPrototypeOf(query)).toBe(Object.prototype)
      expect(Object.keys(query)).toEqual(['b'])
      expect(forInKeys(query)).toEqual(['b'])
      expect(query).toEqual({ b: '1' })
    }
  })
})
