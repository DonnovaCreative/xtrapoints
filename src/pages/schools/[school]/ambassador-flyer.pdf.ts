// On-demand ambassador flyer PDF at /schools/<slug>/ambassador-flyer.pdf.
// Renders the sibling HTML page (/schools/<slug>/ambassador-flyer) to a single
// US-Letter PDF via headless Chromium, then it's CDN-cached — the same on-demand
// pattern as one-pager.pdf.ts and og.png.ts, so build time stays flat.
import type { APIRoute } from "astro";
import { getSchool } from "@/data/schoolsSource";
import { renderSheetPdf } from "@/lib/printSheet";
import { getOverrideVersion } from "@/data/templateOverrides";
import { sheetCacheHeaders } from "@/lib/sheetCache";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.school;
  const school = slug ? await getSchool(slug) : undefined;
  if (!school) return new Response("Not found", { status: 404 });

  const pageUrl = new URL(`/schools/${slug}/ambassador-flyer`, url.origin).href;
  const version = await getOverrideVersion(school.slug, "ambassador-flyer");

  try {
    const pdf = await renderSheetPdf(pageUrl);
    const filename = `${school.short.replace(/[^\w-]+/g, "-")}-Ambassador-Flyer.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...sheetCacheHeaders(version, url),
      },
    });
  } catch (err) {
    console.error("ambassador flyer PDF render failed:", err);
    return new Response("PDF generation failed", { status: 500 });
  }
};
