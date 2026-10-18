// Only used via String.prototype.replace, which resets lastIndex, so sharing
// these global regexes across calls is safe.
const PATH_DELIMITERS = /([/#?\\])/gi
const PATH_DELIMITERS_AND_ENCODED = /([/#?\\]|%(2f|23|3f|5c))/gi

// escape delimiters used by path-to-regexp
export default function escapePathDelimiters(
  segment: string,
  escapeEncoded?: boolean
): string {
  return segment.replace(
    escapeEncoded ? PATH_DELIMITERS_AND_ENCODED : PATH_DELIMITERS,
    (char: string) => encodeURIComponent(char)
  )
}
