import type { BaseNextRequest } from '../../../../server/base-http'
import type { ProxyMatcher } from '../../../../build/analysis/get-page-static-info'
import type { Params } from '../../../../server/request/params'
import { matchHas } from './prepare-destination'

export interface MiddlewareRouteMatch {
  (
    pathname: string | null | undefined,
    request: BaseNextRequest,
    query: Params
  ): boolean
}

export function getMiddlewareRouteMatcher(
  matchers: ProxyMatcher[]
): MiddlewareRouteMatch {
  // Compile each matcher's regexp once (and again only if its source changes)
  // instead of on every call. The regexps carry no g/y flag, so reuse is
  // stateless. Compilation stays lazy, so an invalid regexp still only throws
  // when it is reached while matching.
  const compiled: Array<{ source: string; regexp: RegExp } | undefined> = []

  return (
    pathname: string | null | undefined,
    req: BaseNextRequest,
    query: Params
  ) => {
    for (let i = 0; i < matchers.length; i++) {
      const matcher = matchers[i]
      let entry = compiled[i]
      if (entry === undefined || entry.source !== matcher.regexp) {
        entry = compiled[i] = {
          source: matcher.regexp,
          regexp: new RegExp(matcher.regexp),
        }
      }
      const routeMatch = entry.regexp.exec(pathname!)
      if (!routeMatch) {
        continue
      }

      if (matcher.has || matcher.missing) {
        const hasParams = matchHas(req, query, matcher.has, matcher.missing)
        if (!hasParams) {
          continue
        }
      }

      return true
    }

    return false
  }
}
