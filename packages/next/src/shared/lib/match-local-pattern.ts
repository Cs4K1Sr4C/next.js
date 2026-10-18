import type { LocalPattern } from './image-config'
import { makeRe } from 'next/dist/compiled/picomatch'

// Globs only come from next.config, so this cache stays bounded. makeRe()
// never sets the g/y flags, so a compiled RegExp can be reused across .test().
const pathnameRes = new Map<string, RegExp>()

function pathnameRe(glob: string): RegExp {
  let re = pathnameRes.get(glob)
  if (!re) {
    re = makeRe(glob, { dot: true })
    pathnameRes.set(glob, re)
  }
  return re
}

// Modifying this function should also modify writeImagesManifest()
export function matchLocalPattern(pattern: LocalPattern, url: URL): boolean {
  if (pattern.search !== undefined) {
    if (pattern.search !== url.search) {
      return false
    }
  }

  if (!pathnameRe(pattern.pathname ?? '**').test(url.pathname)) {
    return false
  }

  return true
}

export function hasLocalMatch(
  localPatterns: LocalPattern[] | undefined,
  urlPathAndQuery: string
): boolean {
  if (!localPatterns) {
    // if the user didn't define "localPatterns", we allow all local images
    return true
  }
  const url = new URL(urlPathAndQuery, 'http://n')
  return localPatterns.some((p) => matchLocalPattern(p, url))
}
