import type { IncomingHttpHeaders } from 'http'

import { HeadersAdapter, ReadonlyHeadersError } from './headers'

describe('HeadersAdapter', () => {
  it('should be able to create a new instance from an IncomingHttpHeaders', () => {
    const headers = {
      'content-type': 'application/json',
      'x-custom-header': 'custom',
    }
    const adapter = HeadersAdapter.from(headers)
    expect(adapter).toBeInstanceOf(HeadersAdapter)
    expect(adapter.get('content-type')).toBe('application/json')
    expect(adapter.get('x-custom-header')).toBe('custom')
  })

  it('should be able to create a new instance from a Headers', () => {
    const headers = new Headers({
      'content-type': 'application/json',
      'x-custom-header': 'custom',
    })
    const adapter = HeadersAdapter.from(headers)
    expect(adapter).toBeInstanceOf(Headers)
    expect(adapter.get('content-type')).toBe('application/json')
    expect(adapter.get('x-custom-header')).toBe('custom')
  })

  it('should be able to create a new instance from a HeadersAdapter', () => {
    const headers = new HeadersAdapter({
      'content-type': 'application/json',
      'x-custom-header': 'custom',
    })
    const adapter = HeadersAdapter.from(headers)
    expect(adapter).toBeInstanceOf(HeadersAdapter)
    expect(adapter.get('content-type')).toBe('application/json')
    expect(adapter.get('x-custom-header')).toBe('custom')
  })

  it('should be able to create a new instance from an object', () => {
    const headers = {
      'content-type': 'application/json',
      'x-custom-header': 'custom',
    }
    const adapter = new HeadersAdapter(headers)
    expect(adapter).toBeInstanceOf(HeadersAdapter)
    expect(adapter.get('content-type')).toBe('application/json')
    expect(adapter.get('x-custom-header')).toBe('custom')
  })

  it('should handle multiple values for a header', () => {
    const headers: IncomingHttpHeaders = {
      'content-type': 'application/json',
      'x-custom-headers': ['custom', 'custom2'],
    }
    const adapter = HeadersAdapter.from(headers)
    expect(adapter).toBeInstanceOf(HeadersAdapter)
    expect(adapter.get('content-type')).toBe('application/json')
    expect(adapter.get('x-custom-headers')).toBe('custom, custom2')
  })

  describe('entries', () => {
    it('should return an iterator of entries', () => {
      const headers = new HeadersAdapter({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom',
      })
      expect(headers).toBeInstanceOf(HeadersAdapter)
      expect(headers).toBeInstanceOf(Headers)

      // Check to see that the entries is an iterator.
      const entries = headers.entries()
      expect(typeof entries[Symbol.iterator]).toBe('function')
      expect(typeof entries.next).toBe('function')

      headers.set('x-custom-header', 'custom2')

      // Check to see that the iterator returns the correct values with
      // lowercased header names.
      const array = Array.from(headers.entries())
      expect(array).toBeInstanceOf(Array)
      expect(array).toHaveLength(2)
      expect(array).toEqual([
        ['content-type', 'application/json'],
        ['x-custom-header', 'custom2'],
      ])
    })
  })

  describe('keys', () => {
    it('should return an iterator of keys', () => {
      const headers = new HeadersAdapter({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom',
      })

      // Check to see that the keys is an iterator.
      const keys = headers.keys()
      expect(typeof keys[Symbol.iterator]).toBe('function')
      expect(typeof keys.next).toBe('function')

      headers.set('x-custom-header', 'custom2')

      // Check to see that the iterator returns the correct values with
      // lowercased header names.
      const array = Array.from(headers.keys())
      expect(array).toBeInstanceOf(Array)
      expect(array).toHaveLength(2)
      expect(array).toEqual(['content-type', 'x-custom-header'])
    })
  })

  describe('values', () => {
    it('should return an iterator of values', () => {
      const headers = new HeadersAdapter({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom',
      })

      // Check to see that the values is an iterator.
      const values = headers.values()
      expect(typeof values[Symbol.iterator]).toBe('function')
      expect(typeof values.next).toBe('function')

      headers.set('x-custom-header', 'custom2')

      // Check to see that the iterator returns the correct values.
      const array = Array.from(headers.values())
      expect(array).toBeInstanceOf(Array)
      expect(array).toHaveLength(2)
      expect(array).toEqual(['application/json', 'custom2'])
    })
  })

  describe('forEach', () => {
    it('should iterate over all entries', () => {
      const headers = new HeadersAdapter({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom',
      })

      const spy = jest.fn()
      headers.forEach(spy)

      expect(spy).toHaveBeenCalledTimes(2)
      expect(spy).toHaveBeenNthCalledWith(
        1,
        'application/json',
        'content-type',
        headers
      )
      expect(spy).toHaveBeenNthCalledWith(
        2,
        'custom',
        'x-custom-header',
        headers
      )
    })
  })

  describe('iterator', () => {
    it('should iterate over all entries', () => {
      const headers = new HeadersAdapter({
        'Content-Type': 'application/json',
        'X-Custom-Header': 'custom',
      })

      const array = Array.from(headers)
      expect(array).toBeInstanceOf(Array)
      expect(array).toHaveLength(2)

      expect(array).toEqual([
        ['content-type', 'application/json'],
        ['x-custom-header', 'custom'],
      ])

      headers.set('x-custom-header', 'custom2')

      const array2 = Array.from(headers)
      expect(array2).toBeInstanceOf(Array)
      expect(array2).toHaveLength(2)

      expect(array2).toEqual([
        ['content-type', 'application/json'],
        ['x-custom-header', 'custom2'],
      ])
    })
  })

  describe('case-insensitive', () => {
    it('should handle different case for header names', () => {
      const headers = new HeadersAdapter({
        'Content-Type': 'application/json',
      })
      expect(headers).toBeInstanceOf(HeadersAdapter)
      expect(headers).toBeInstanceOf(Headers)

      expect(headers.get('content-type')).toBe('application/json')
      expect(headers.get('Content-Type')).toBe('application/json')
    })

    it('should handle different case for header names when mutated out of band', () => {
      const incoming: IncomingHttpHeaders = {
        'Content-Type': 'application/json',
      }
      const headers = new HeadersAdapter(incoming)
      expect(headers).toBeInstanceOf(HeadersAdapter)
      expect(headers).toBeInstanceOf(Headers)

      expect(headers.get('content-type')).toBe('application/json')
      expect(headers.get('Content-Type')).toBe('application/json')

      incoming['X-Custom-Header'] = 'custom'

      expect(headers.get('X-Custom-Header')).toBe('custom')
      expect(headers.get('x-custom-header')).toBe('custom')

      headers.set('x-custom-header', 'custom2')

      expect(headers.get('X-Custom-Header')).toBe('custom2')
      expect(headers.get('x-custom-header')).toBe('custom2')

      // Ensure the original headers object was mutated.
      expect(incoming['X-Custom-Header']).toBe('custom2')
    })

    it('should return the value of the first case-insensitive key match', () => {
      // The reference lookup: the first key whose lowercase form matches.
      function scan(raw: IncomingHttpHeaders, name: string): string | null {
        const lowercased = name.toLowerCase()
        const original = Object.keys(raw).find(
          (key) => key.toLowerCase() === lowercased
        )
        if (typeof original === 'undefined') return null

        const value = raw[original]
        if (typeof value === 'undefined') return null

        return Array.isArray(value) ? value.join(', ') : value
      }

      const nonEnumerable: IncomingHttpHeaders = { 'content-type': 'text/html' }
      Object.defineProperty(nonEnumerable, 'x-non-enumerable', {
        value: 'hidden',
        enumerable: false,
        configurable: true,
      })

      const inputs: IncomingHttpHeaders[] = [
        {
          'content-type': 'application/json',
          'set-cookie': ['a=1', 'b=2'],
          'x-empty': '',
          'x-undefined': undefined,
        },
        { 'Content-Type': 'application/json', 'X-Custom-Header': 'custom' },
        JSON.parse('{"__proto__":"own-proto","constructor":"own-ctor"}'),
        nonEnumerable,
        Object.assign(Object.create(null), { 'x-null-proto': 'yes' }),
        {},
      ]
      const names = [
        'content-type',
        'Content-Type',
        'CONTENT-TYPE',
        'set-cookie',
        'x-empty',
        'x-undefined',
        'x-custom-header',
        'X-Custom-Header',
        'x-non-enumerable',
        'x-null-proto',
        '__proto__',
        'constructor',
        'toString',
        'hasOwnProperty',
        'missing',
        '',
      ]

      for (const raw of inputs) {
        const headers = new HeadersAdapter(raw)
        for (const name of names) {
          expect([name, headers.get(name)]).toEqual([name, scan(raw, name)])
          expect([name, headers.has(name)]).toEqual([
            name,
            scan(raw, name) !== null,
          ])
        }

        expect(Array.from(headers.entries())).toEqual(
          Object.keys(raw).map((key) => [key.toLowerCase(), scan(raw, key)])
        )
        expect(Array.from(headers.values())).toEqual(
          Object.keys(raw).map((key) => scan(raw, key))
        )
      }
    })
  })

  describe('iteration', () => {
    function createCountingHeaders(size: number) {
      const raw: IncomingHttpHeaders = {}
      for (let i = 0; i < size; i++) {
        raw[`x-header-${i}`] = `value-${i}`
      }

      // Counts how often the header names are listed. Each listing walks every
      // key, so iteration must list them once rather than once per header.
      const counter = { ownKeys: 0 }
      const counted = new Proxy(raw, {
        ownKeys(target) {
          counter.ownKeys++
          return Reflect.ownKeys(target)
        },
      })

      return { raw, counter, headers: new HeadersAdapter(counted) }
    }

    it('should list the header names once per full iteration', () => {
      const { raw, counter, headers } = createCountingHeaders(1000)
      const expected = Object.entries(raw)

      counter.ownKeys = 0
      expect(Array.from(headers.entries())).toEqual(expected)
      expect(counter.ownKeys).toBe(1)

      counter.ownKeys = 0
      expect(Array.from(headers.values())).toEqual(
        expected.map(([, value]) => value)
      )
      expect(counter.ownKeys).toBe(1)

      const sealed = HeadersAdapter.seal(headers, new Set(['rsc']))
      counter.ownKeys = 0
      expect(Object.fromEntries(sealed)).toEqual(raw)
      expect(counter.ownKeys).toBe(1)
    })

    it('should not list the header names for an exact lookup', () => {
      const { counter, headers } = createCountingHeaders(1000)

      counter.ownKeys = 0
      expect(headers.get('x-header-999')).toBe('value-999')
      expect(headers.has('x-header-0')).toBe(true)
      expect(counter.ownKeys).toBe(0)

      // Lookups that are not an exact key still match case-insensitively.
      expect(headers.get('X-Header-999')).toBe('value-999')
      expect(headers.get('x-header-1000')).toBeNull()
    })
  })

  describe('sealed', () => {
    it('should be able to seal a Headers instance', () => {
      const headers = new Headers({
        'content-type': 'application/json',
        'x-custom-header': 'custom',
      })
      const sealed = HeadersAdapter.seal(headers)
      expect(sealed).toBeInstanceOf(Headers)

      expect(sealed.get('content-type')).toBe('application/json')
      expect(sealed.get('x-custom-header')).toBe('custom')

      // These methods are not available on the sealed instance
      expect(() =>
        (sealed as any).append('x-custom-header', 'custom2')
      ).toThrow(ReadonlyHeadersError)
      expect(() =>
        (sealed as any).append('x-custom-header', 'custom2')
      ).toThrow(ReadonlyHeadersError)
      expect(() => (sealed as any).delete('x-custom-header')).toThrow(
        ReadonlyHeadersError
      )
      expect(() => (sealed as any).set('x-custom-header', 'custom2')).toThrow(
        ReadonlyHeadersError
      )

      expect(sealed.get('content-type')).toBe('application/json')
      expect(sealed.get('x-custom-header')).toBe('custom')
    })

    it('should be able to seal a HeadersAdapter instance', () => {
      const headers = new HeadersAdapter({
        'content-type': 'application/json',
        'x-custom-header': 'custom',
      })
      const sealed = HeadersAdapter.seal(headers)
      expect(sealed).toBeInstanceOf(HeadersAdapter)
      expect(sealed).toBeInstanceOf(Headers)

      // These methods are not available on the sealed instance
      expect(() =>
        (sealed as any).append('x-custom-header', 'custom2')
      ).toThrow(ReadonlyHeadersError)
      expect(() => (sealed as any).delete('x-custom-header')).toThrow(
        ReadonlyHeadersError
      )
      expect(() => (sealed as any).set('x-custom-header', 'custom2')).toThrow(
        ReadonlyHeadersError
      )

      // Ensure nothing was actually changed.
      expect(sealed.get('content-type')).toBe('application/json')
      expect(sealed.get('x-custom-header')).toBe('custom')
    })

    it('should be able to seal a HeadersAdapter and still mutate the original', () => {
      const incoming: IncomingHttpHeaders = {
        'content-type': 'application/json',
        'X-Custom-Header': 'custom',
      }

      const headers = new HeadersAdapter(incoming)
      const sealed = HeadersAdapter.seal(headers)
      expect(sealed).toBeInstanceOf(HeadersAdapter)
      expect(sealed).toBeInstanceOf(Headers)

      // These methods are not available on the sealed instance
      expect(() =>
        (sealed as any).append('x-custom-header', 'custom2')
      ).toThrow(ReadonlyHeadersError)
      expect(() => (sealed as any).delete('x-custom-header')).toThrow(
        ReadonlyHeadersError
      )
      expect(() => (sealed as any).set('x-custom-header', 'custom2')).toThrow(
        ReadonlyHeadersError
      )

      // Ensure nothing was actually changed.
      expect(sealed.get('content-type')).toBe('application/json')
      expect(sealed.get('x-custom-header')).toBe('custom')

      // Mutate the original.
      headers.append('x-custom-header', 'custom2')

      // Ensure the original was mutated.
      expect(headers.get('content-type')).toBe('application/json')
      expect(headers.get('x-custom-header')).toBe('custom, custom2')

      // Mutate the incoming headers object.
      incoming['X-Custom-Header'] = 'custom3'

      expect(headers.get('x-custom-header')).toBe('custom3')
      expect(sealed.get('x-custom-header')).toBe('custom3')
    })

    it('should return the same method instance on repeated access', () => {
      const headers = new Headers({ 'content-type': 'application/json' })

      for (const sealed of [
        HeadersAdapter.seal(headers),
        HeadersAdapter.seal(headers, new Set(['rsc'])),
      ]) {
        expect(sealed.get).toBe(sealed.get)
        expect(sealed.has).toBe(sealed.has)
        expect(sealed.getSetCookie).toBe(sealed.getSetCookie)
        expect(sealed.keys).toBe(sealed.keys)
        expect(sealed.values).toBe(sealed.values)
        expect(sealed.entries).toBe(sealed.entries)
        expect(sealed.forEach).toBe(sealed.forEach)
        expect(sealed[Symbol.iterator]).toBe(sealed[Symbol.iterator])
      }
    })

    it('should pass the sealed instance to forEach callbacks', () => {
      const headers = new Headers({ 'content-type': 'application/json' })
      const sealed = HeadersAdapter.seal(headers)

      const parents: Headers[] = []
      sealed.forEach((_value, _name, parent) => {
        parents.push(parent)
      })

      expect(parents).toHaveLength(1)
      expect(parents[0]).toBe(sealed)
      expect(() => parents[0].set('x-escaped', 'yes')).toThrow(
        ReadonlyHeadersError
      )
      expect(headers.get('x-escaped')).toBeNull()
    })

    describe('with hidden headers', () => {
      const hidden = new Set(['rsc', 'x-nextjs-request-id'])

      function createSealed() {
        const headers = new Headers({
          'content-type': 'application/json',
          rsc: '1',
          'x-nextjs-request-id': 'req-1',
          'x-custom-header': 'custom',
        })

        return { headers, sealed: HeadersAdapter.seal(headers, hidden) }
      }

      it('should omit hidden headers from every read operation', () => {
        const { sealed } = createSealed()

        expect(sealed.get('rsc')).toBeNull()
        expect(sealed.get('RSC')).toBeNull()
        expect(sealed.get('x-nextjs-request-id')).toBeNull()
        expect(sealed.has('rsc')).toBe(false)
        expect(sealed.has('x-nextjs-request-id')).toBe(false)

        expect([...sealed.keys()]).toEqual(['content-type', 'x-custom-header'])
        expect([...sealed.values()]).toEqual(['application/json', 'custom'])
        expect([...sealed.entries()]).toEqual([
          ['content-type', 'application/json'],
          ['x-custom-header', 'custom'],
        ])
        expect([...sealed]).toEqual([
          ['content-type', 'application/json'],
          ['x-custom-header', 'custom'],
        ])

        const seen: string[] = []
        sealed.forEach((value, name, parent) => {
          seen.push(`${name}=${value}`)
          expect(parent).toBe(sealed)
        })
        expect(seen).toEqual([
          'content-type=application/json',
          'x-custom-header=custom',
        ])

        expect(Object.fromEntries(sealed)).toEqual({
          'content-type': 'application/json',
          'x-custom-header': 'custom',
        })
        expect([...new Headers(sealed).keys()]).toEqual([
          'content-type',
          'x-custom-header',
        ])
      })

      it('should omit hidden set-cookie headers from getSetCookie', () => {
        const headers = new Headers()
        headers.append('set-cookie', 'a=1')

        expect(HeadersAdapter.seal(headers, hidden).getSetCookie()).toEqual([
          'a=1',
        ])
        expect(
          HeadersAdapter.seal(headers, new Set(['set-cookie'])).getSetCookie()
        ).toEqual([])
      })

      it('should not copy or mutate the underlying headers', () => {
        const { headers, sealed } = createSealed()

        expect(sealed.get('content-type')).toBe('application/json')
        expect(headers.get('rsc')).toBe('1')
        expect(headers.get('x-nextjs-request-id')).toBe('req-1')

        expect(() => (sealed as any).delete('rsc')).toThrow(
          ReadonlyHeadersError
        )
        expect(headers.get('rsc')).toBe('1')
      })

      it('should stay a live view of the underlying headers', () => {
        const { headers, sealed } = createSealed()

        headers.set('x-added-after-seal', 'live')
        expect(sealed.get('x-added-after-seal')).toBe('live')

        headers.delete('x-custom-header')
        expect(sealed.get('x-custom-header')).toBeNull()

        // Hidden headers stay hidden, no matter when they are written.
        headers.set('rsc', '2')
        expect(sealed.get('rsc')).toBeNull()
        expect(headers.get('rsc')).toBe('2')
      })
    })
  })
})
