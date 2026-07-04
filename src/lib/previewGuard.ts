// Shared secret gate for the on-demand draft-preview routes
// (preview/schools/[slug], .../ambassadors, preview/legal/[slug]).
//
// Returns a 401 Response when the ?secret query param is missing or doesn't match
// the server-only PREVIEW_SECRET env var, else null (proceed). Keeping unpublished
// content (trademarked logos, unreviewed copy) unreachable without the secret.

export function previewUnauthorized(url: URL): Response | null {
  const expected = process.env.PREVIEW_SECRET ?? import.meta.env.PREVIEW_SECRET;
  const provided = url.searchParams.get("secret");
  if (!expected || provided !== expected) {
    return new Response(
      "Unauthorized — a valid preview secret is required. Open this page from the “Open preview” button in the Studio.",
      { status: 401, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }
  return null;
}
