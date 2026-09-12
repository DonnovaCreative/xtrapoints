// A school publication can change branding independently of a template's version.
// Keep generated exports fresh even when their template query parameter is pinned.
export function sheetCacheHeaders(
  _version: string | undefined,
  _url: URL,
): Record<string, string> {
  return {
    "Cache-Control": "public, max-age=30, must-revalidate",
    "CDN-Cache-Control": "public, max-age=30",
  };
}
