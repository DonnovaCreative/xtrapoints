// =============================================================================
// ENVIRONMENT / INDEXING CONTROL — single source of truth for "should this
// deployment be de-indexed by search engines?"
//
// Vercel sets the system env var VERCEL_ENV during every build:
//   • "production"  → the Production deployment (xtrapoint.com / www)
//   • "preview"     → branch/PR preview deploys (incl. the staging branch)
//   • a custom name → if a Vercel "Custom Environment" is used (e.g. "staging")
// It is undefined on local `npm run build` / `astro dev`.
//
// GUARD — production must NEVER be accidentally de-indexed:
//   We de-index ONLY when VERCEL_ENV is set AND is not exactly "production".
//   • Production deploys are ALWAYS VERCEL_ENV="production" → never de-indexed.
//   • A missing var (local dev) → NOT de-indexed (local isn't public anyway).
//   • Any non-production Vercel env (preview / staging / custom) → de-indexed,
//     even if the env is renamed, since we allowlist exactly "production".
// This is an allowlist on the ONE value that must stay indexable, so an
// unexpected/empty value can never silently noindex production.
// =============================================================================

const vercelEnv = process.env.VERCEL_ENV;

/** True only on the Vercel Production deployment. */
export const isProduction = vercelEnv === "production";

/** De-index everything that is positively a non-production Vercel deployment. */
export const shouldNoindex = Boolean(vercelEnv) && vercelEnv !== "production";
