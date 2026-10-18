import { getRenderedSearch, searchParamsToUrlQuery } from './querystring'

function forInKeys(obj: object): string[] {
  const keys: string[] = []
  for (const key in obj) keys.push(key)
  return keys
}

describe('searchParamsToUrlQuery', () => {
  it.each([
    ['', {}],
    ['a=1', { a: '1' }],
    ['a=1&b=2', { a: '1', b: '2' }],
    ['a=1&a=2', { a: ['1', '2'] }],
    ['a=1&b=2&a=3&a=4', { a: ['1', '3', '4'], b: '2' }],
    ['a=&a=1&b', { a: ['', '1'], b: '' }],
    ['=1&=2', { '': ['1', '2'] }],
    ['a=%20x&b=+y&c=%2B', { a: ' x', b: ' y', c: '+' }],
    ['%C3%A9=%F0%9F%98%80', { é: '😀' }],
  ])('parses %j', (search, expected) => {
    const query = searchParamsToUrlQuery(new URLSearchParams(search))
    expect(query).toEqual(expected)
    expect(Object.getPrototypeOf(query)).toBe(Object.prototype)
  })

  it('does not merge inherited Object.prototype members into values', () => {
    const query = searchParamsToUrlQuery(
      new URLSearchParams(
        'constructor=x&toString=y&valueOf=v&hasOwnProperty=1&a=1&a=2'
      )
    )
    expect(Object.keys(query)).toEqual([
      'constructor',
      'toString',
      'valueOf',
      'hasOwnProperty',
      'a',
    ])
    expect(query.constructor).toBe('x')
    expect(query.toString).toBe('y')
    expect(query.valueOf).toBe('v')
    expect(query.hasOwnProperty).toBe('1')
    expect(query.a).toEqual(['1', '2'])
  })

  it('collects repeated keys that name Object.prototype members', () => {
    const query = searchParamsToUrlQuery(
      new URLSearchParams('constructor=x&constructor=z&toString=y')
    )
    expect(query).toEqual({ constructor: ['x', 'z'], toString: 'y' })
  })

  it('does not replace the prototype via __proto__', () => {
    for (const search of [
      '__proto__=x&b=1',
      '__proto__=x&__proto__=y&b=1',
      'b=1&__proto__=x&__proto__=y&__proto__=z',
    ]) {
      const query = searchParamsToUrlQuery(new URLSearchParams(search))
      expect(Object.getPrototypeOf(query)).toBe(Object.prototype)
      expect(Object.keys(query)).toEqual(['b'])
      expect(forInKeys(query)).toEqual(['b'])
      expect(query).toEqual({ b: '1' })
      expect(getRenderedSearch(query)).toBe('?b=1')
    }
    expect(Object.prototype).not.toHaveProperty('0')
  })
})
