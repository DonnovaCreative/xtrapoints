import type { APIRoute } from "astro";
import { brand } from "@/config/brand";
import { shouldNoindex } from "@/config/site-env";

// Generated at build time. On non-production Vercel deploys (staging / preview)
// we disallow all crawling; on production we allow it and advertise the sitemap.
// The env decision is centralized in src/config/site-env.ts (see the prod guard).
//
// /portal/ is disallowed on production: those are the private per-school
// marketing portals, unguessable by design but crawlable if a school ever pastes
// their link somewhere public. The routes also send X-Robots-Tag: noindex, which
// is the protection that actually holds — this just stops a well-behaved crawler
// from fetching them at all.
export const GET: APIRoute = () =>
  new Response(
    shouldNoindex
      ? `User-agent: *\nDisallow: /\n`
      : `User-agent: *\nAllow: /\nDisallow: /portal/\n\nSitemap: ${brand.url}/sitemap-index.xml\n`,
    { headers: { "Content-Type": "text/plain" } },
  );
