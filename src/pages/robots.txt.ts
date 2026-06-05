import type { APIRoute } from "astro";
import { brand } from "@/config/brand";

// Generated so the sitemap URL follows the brand domain (src/config/brand.ts).
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\n\nSitemap: ${brand.url}/sitemap-index.xml\n`,
    { headers: { "Content-Type": "text/plain" } },
  );
