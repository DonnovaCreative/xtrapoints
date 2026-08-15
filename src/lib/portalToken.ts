// Shape of the Marketing Portal access token that forms the private per-school
// URL (/portal/<token>). Minted by the Studio's PortalLinkInput as 16 random
// bytes → 32 hex chars (128 bits), which is far past guessable.
//
// The site checks the SHAPE before hitting Sanity: a token that can't have come
// from the generator can't match a real school, so there's no reason to spend a
// query on it. This also means a truncated or hand-typed link fails fast instead
// of probing the dataset.
//
// Keep in sync with the `portalToken` validation rule in studio/schemas/school.ts.

export const PORTAL_TOKEN_PATTERN = /^[0-9a-f]{32}$/;

export const isWellFormedPortalToken = (token: string | undefined): token is string =>
  typeof token === "string" && PORTAL_TOKEN_PATTERN.test(token);
