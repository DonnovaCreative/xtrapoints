import type { APIRoute } from "astro";
import { brand } from "@/config/brand";
import { shouldNoindex } from "@/config/site-env";

// Generated at build time. On non-production Vercel deploys (staging / preview)
// we disallow all crawling; on production we allow it and advertise the sitemap.
// The env decision is centralized in src/config/site-env.ts (see the prod guard).
export const GET: APIRoute = () =>
  new Response(
    shouldNoindex
      ? `User-agent: *\nDisallow: /\n`
      : `User-agent: *\nAllow: /\n\nSitemap: ${brand.url}/sitemap-index.xml\n`,
    { headers: { "Content-Type": "text/plain" } },
  );
