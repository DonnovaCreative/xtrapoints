// On-demand PNG of the co-branded sales one-pager at /schools/<slug>/one-pager.png.
//
// This is the *preview image* the Marketing Portal shows on the one-pager card —
// schools shouldn't have to download a PDF to find out what's in it. It renders
// the same sibling HTML page the PDF does (/schools/<slug>/one-pager), so the
// thumbnail can't drift from the file they actually get, and it re-renders itself
// whenever a school's logo or colors change — no image to regenerate by hand.
//
// Same on-demand + CDN-cached pattern as og.png.ts and one-pager.pdf.ts, so build
// time stays flat no matter how many schools there are.
import type { APIRoute } from "astro";
import { getSchool } from "@/data/schoolsSource";
import { renderOnePagerImage } from "@/lib/onePagerPdf";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.school;
  const school = slug ? await getSchool(slug) : undefined;
  if (!school) return new Response("Not found", { status: 404 });

  const pageUrl = new URL(`/schools/${slug}/one-pager`, url.origin).href;

  try {
    const png = await renderOnePagerImage(pageUrl);
    return new Response(png, {
      headers: {
        "Content-Type": "image/png",
        // Inline, not a download — this one is for looking at. The PDF route is
        // the one that hands over a file.
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=3600",
        "CDN-Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err) {
    console.error("one-pager PNG render failed:", err);
    return new Response("Preview generation failed", { status: 500 });
  }
};
