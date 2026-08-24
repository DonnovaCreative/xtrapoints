// On-demand PNG of the ambassador flyer at /schools/<slug>/ambassador-flyer.png.
//
// The preview image the Marketing Portal shows on the flyer's resource card —
// schools shouldn't have to download a PDF to find out what's in it. It renders
// the same sibling HTML page the PDF does, so the thumbnail can't drift from the
// file they actually get, and it re-renders itself whenever a school changes its
// logo, colors or photos — no image to regenerate by hand.
import type { APIRoute } from "astro";
import { getSchool } from "@/data/schoolsSource";
import { renderSheetImage } from "@/lib/printSheet";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.school;
  const school = slug ? await getSchool(slug) : undefined;
  if (!school) return new Response("Not found", { status: 404 });

  const pageUrl = new URL(`/schools/${slug}/ambassador-flyer`, url.origin).href;

  try {
    const png = await renderSheetImage(pageUrl, { selector: ".af-sheet" });
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
    console.error("ambassador flyer PNG render failed:", err);
    return new Response("Preview generation failed", { status: 500 });
  }
};
