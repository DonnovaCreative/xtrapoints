const SCHOOL_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LEGACY_PORTAL_TOKEN = /^[0-9a-f]{32}$/;
const RESERVED_PORTAL_ROUTES = new Set(["account"]);

/**
 * Turn an optional remembered school slug into a local navigation hint.
 * Never accept a full portal URL: legacy URLs can contain bearer credentials.
 * This grants no access; the destination still checks the current account.
 */
export function marketingHrefForSlug(value: unknown): string | undefined {
  if (
    typeof value !== "string" ||
    value.length > 96 ||
    !SCHOOL_SLUG.test(value) ||
    LEGACY_PORTAL_TOKEN.test(value) ||
    RESERVED_PORTAL_ROUTES.has(value)
  ) {
    return undefined;
  }
  return `/portal/${value}`;
}
