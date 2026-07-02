// Sanity client for reading school content at build time (and in the on-demand
// OG function). projectId/dataset are not secret (they're in the Studio's
// sanity.cli.ts too); the read token IS — it comes from the SANITY_READ_TOKEN
// env var (Vercel: Production + Preview; local: .env). Server-side only, so it
// never ships to the browser.
import { createClient } from "@sanity/client";

export const SANITY_PROJECT_ID = "xjhhxbqk";
export const SANITY_DATASET = "production";

// process.env is populated at runtime (the Vercel function); import.meta.env is
// populated at build (from .env / Vercel build env). Check both.
const token =
  process.env.SANITY_READ_TOKEN ?? import.meta.env.SANITY_READ_TOKEN;

export const sanityClient = createClient({
  projectId: SANITY_PROJECT_ID,
  dataset: SANITY_DATASET,
  apiVersion: "2025-01-01",
  // Reads run at build (webhook-triggered after publish) — go direct so we
  // never serve stale content from the CDN edge.
  useCdn: false,
  token,
});
