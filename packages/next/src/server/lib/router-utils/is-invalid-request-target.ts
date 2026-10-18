/**
 * Node accepts asterisk-form request targets (`OPTIONS * HTTP/1.1`) and some
 * unparseable absolute-form targets (`GET http://[ HTTP/1.1`) and passes them
 * through as `req.url`. The router cannot turn these into a URL, so they are
 * rejected before routing instead of throwing `ERR_INVALID_URL`.
 */
export function isInvalidRequestTarget(url: string | undefined): boolean {
  return !!url && url[0] !== '/' && !URL.canParse(url)
}
