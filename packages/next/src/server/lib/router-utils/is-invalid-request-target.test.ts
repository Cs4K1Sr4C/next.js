/* eslint-env jest */

import { isInvalidRequestTarget } from './is-invalid-request-target'
import { parseUrl } from '../../../shared/lib/router/utils/parse-url'

describe('isInvalidRequestTarget', () => {
  // Node's HTTP parser hands these to the 'request' handler as `req.url`, but
  // the router cannot parse them into a URL.
  it.each(['*', '*foo', 'http://['])('rejects %j', (url) => {
    expect(isInvalidRequestTarget(url)).toBe(true)
  })

  it.each([
    undefined,
    '',
    '/',
    '/a?b=1',
    '//[',
    '//a:b',
    '/\\[',
    '/%zz',
    'http://example.com/x',
    'http://example.com//x?y=1',
    'http://a/[',
  ])('accepts %j', (url) => {
    expect(isInvalidRequestTarget(url)).toBe(false)
  })

  // The router parses `req.url` with `parseUrl` in resolve-routes and the i18n
  // locale detection. Every target this rejects must be one that `parseUrl`
  // throws on, so no request that is handled today starts getting a 400.
  it.each([
    '*',
    '*foo',
    'http://[',
    '/',
    '/a?b=1',
    '//[',
    '//a:b',
    '/\\[',
    '/%zz',
    'http://example.com/x',
    'http://example.com//x?y=1',
    'http://a/[',
  ])('matches whether parseUrl throws for %j', (url) => {
    let throws = false
    try {
      parseUrl(url)
    } catch {
      throws = true
    }
    expect(isInvalidRequestTarget(url)).toBe(throws)
  })
})
