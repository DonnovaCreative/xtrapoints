// On-demand per-school Open Graph card at /schools/<slug>/og.png. Rendered by a
// Vercel serverless function on first request, then served from the CDN cache —
// so build time stays flat no matter how many schools exist (the reason this is
// `prerender = false` rather than a build-time getStaticPaths). Fonts + logos it
// reads from disk are bundled into the function via `includeFiles` in
// astro.config.mjs. Wired into the page <head> via Layout's `ogImage` prop.
import type { APIRoute } from "astro";
import { getSchool } from "@/data/schoolsSource";
import { renderSchoolOg } from "@/og/renderSchoolOg";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const school = params.school ? await getSchool(params.school) : undefined;
  if (!school) return new Response("Not found", { status: 404 });

  const png = await renderSchoolOg(school);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // Browser cache. `immutable` is safe because a rebrand changes the logo/
      // colors and we bust with a versioned query if/when that happens.
      "Cache-Control": "public, max-age=31536000, immutable",
      // Vercel strips s-maxage from plain Cache-Control, so set the CDN's copy
      // explicitly — this is what makes each card generate once, then cache.
      "CDN-Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
