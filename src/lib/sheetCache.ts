// Cache headers for the generated sheets (PDF + PNG).
//
// These were straightforwardly long-lived when a sheet could only change via a
// deploy: a rebrand ships a new function, so a day at the edge was free. Schools
// customising their own flyer breaks that assumption — an edit has to be
// downloadable now, not after the CDN's TTL expires.
//
// The portal links to the export with `?v=<updatedAt>`, so every edit produces a
// new URL and therefore a new cache entry: those can stay long-lived. A bare URL
// with no version can't make that promise, so once a school has customised the
// sheet at all, it drops to a short TTL.

/** How long an unversioned sheet may be cached once it's customisable. */
const SHORT = 60;
const LONG = 3600;
const LONG_CDN = 86400;

export function sheetCacheHeaders(
  version: string | undefined,
  url: URL,
): Record<string, string> {
  const asked = url.searchParams.get("v");
  // Versioned and current → immutable for this URL. A stale `v` is treated as
  // unversioned rather than trusted, so an old link can't pin an old render.
  const pinned = Boolean(version && asked && asked === version);

  if (!version || pinned) {
    return {
      "Cache-Control": `public, max-age=${LONG}`,
      "CDN-Cache-Control": `public, max-age=${LONG_CDN}`,
      ...(version ? { ETag: `"${version}"` } : {}),
    };
  }

  return {
    "Cache-Control": `public, max-age=${SHORT}, must-revalidate`,
    "CDN-Cache-Control": `public, max-age=${SHORT}`,
    ETag: `"${version}"`,
  };
}
