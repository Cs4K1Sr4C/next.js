import type { PathnameNormalizer } from './pathname-normalizer'

import {
  RSC_SEGMENT_SUFFIX,
  RSC_SEGMENTS_DIR_SUFFIX,
} from '../../../lib/constants'

// The segment path always starts with `/`, so search for `.segments/`.
const SEGMENTS_DIR = RSC_SEGMENTS_DIR_SUFFIX + '/'
// `.` in the former regex did not match line terminators.
const LINE_TERMINATOR = /[\n\r\u2028\u2029]/

export class SegmentPrefixRSCPathnameNormalizer implements PathnameNormalizer {
  public match(pathname: string): boolean {
    return this.extract(pathname) !== null
  }

  // Linear equivalent of /^(\/.*)\.segments(\/.*)\.segment\.rsc$/ (greedy
  // first group); the regex backtracks quadratically on many `.segments/`.
  public extract(pathname: string) {
    if (
      pathname.charCodeAt(0) !== 47 /* '/' */ ||
      !pathname.endsWith(RSC_SEGMENT_SUFFIX) ||
      LINE_TERMINATOR.test(pathname)
    ) {
      return null
    }
    const end = pathname.length - RSC_SEGMENT_SUFFIX.length
    // `.segments/` must end at or before `end` so the segment path is >= '/'.
    const index = pathname.lastIndexOf(SEGMENTS_DIR, end - SEGMENTS_DIR.length)
    if (index < 1) return null

    return {
      originalPathname: pathname.slice(0, index),
      segmentPath: pathname.slice(index + RSC_SEGMENTS_DIR_SUFFIX.length, end),
    }
  }

  public normalize(pathname: string): string {
    const match = this.extract(pathname)
    if (!match) return pathname

    return match.originalPathname
  }
}
