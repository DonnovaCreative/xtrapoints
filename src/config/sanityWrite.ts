// Sanity client with WRITE access, used only by the portal's brand editor
// (src/pages/api/portal-brand.ts).
//
// Kept separate from the read client on purpose: this token can change content,
// so the smaller and more obvious its blast radius, the better. Nothing else
// should import it, and it must never be referenced from client code — there is
// no PUBLIC_ prefix and there never should be.
//
// The token needs Editor permissions on the `production` dataset. Create it at
// sanity.io/manage → API → Tokens, and set SANITY_WRITE_TOKEN in Vercel
// (Production + Preview) and .env locally.
import { createClient } from "@sanity/client";
import { SANITY_PROJECT_ID, SANITY_DATASET } from "@/config/sanity";

const token = process.env.SANITY_WRITE_TOKEN ?? import.meta.env.SANITY_WRITE_TOKEN;

/** Throws rather than silently no-opping if the token is missing. */
export function writeClient() {
  if (!token) throw new Error("SANITY_WRITE_TOKEN is not configured");
  return createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: "2025-01-01",
    useCdn: false,
    token,
  });
}
