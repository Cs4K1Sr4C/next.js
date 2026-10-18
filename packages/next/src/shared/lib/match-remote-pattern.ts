import type { RemotePattern } from './image-config'
import { makeRe } from 'next/dist/compiled/picomatch'

// Globs only come from next.config, so these caches stay bounded. makeRe()
// never sets the g/y flags, so a compiled RegExp can be reused across .test().
const hostnameRes = new Map<string, RegExp>()
const pathnameRes = new Map<string, RegExp>()

function hostnameRe(glob: string): RegExp {
  let re = hostnameRes.get(glob)
  if (!re) {
    re = makeRe(glob)
    hostnameRes.set(glob, re)
  }
  return re
}

function pathnameRe(glob: string): RegExp {
  let re = pathnameRes.get(glob)
  if (!re) {
    re = makeRe(glob, { dot: true })
    pathnameRes.set(glob, re)
  }
  return re
}

// Modifying this function should also modify writeImagesManifest()
export function matchRemotePattern(
  pattern: RemotePattern | URL,
  url: URL
): boolean {
  if (pattern.protocol !== undefined) {
    if (pattern.protocol.replace(/:$/, '') !== url.protocol.replace(/:$/, '')) {
      return false
    }
  }
  if (pattern.port !== undefined) {
    if (pattern.port !== url.port) {
      return false
    }
  }

  if (pattern.hostname === undefined) {
    throw new Error(
      `Pattern should define hostname but found\n${JSON.stringify(pattern)}`
    )
  } else {
    if (!hostnameRe(pattern.hostname).test(url.hostname)) {
      return false
    }
  }

  if (pattern.search !== undefined) {
    if (pattern.search !== url.search) {
      return false
    }
  }

  // Should be the same as writeImagesManifest()
  if (!pathnameRe(pattern.pathname ?? '**').test(url.pathname)) {
    return false
  }

  return true
}

export function hasRemoteMatch(
  domains: string[],
  remotePatterns: Array<RemotePattern | URL>,
  url: URL
): boolean {
  return (
    domains.some((domain) => url.hostname === domain) ||
    remotePatterns.some((p) => matchRemotePattern(p, url))
  )
}
