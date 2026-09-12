// On-demand co-branded sales one-pager PDF at /schools/<slug>/one-pager.pdf.
// Renders the sibling HTML page (/schools/<slug>/one-pager) to a single US-Letter
// PDF via headless Chromium (shared helper), then it's CDN-cached — same
// on-demand pattern as og.png.ts, so build time stays flat.
import type { APIRoute } from "astro";
import { getSchool } from "@/data/schoolsSource";
import { renderSheetPdf } from "@/lib/printSheet";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.school;
  const school = slug ? await getSchool(slug) : undefined;
  if (!school) return new Response("Not found", { status: 404 });

  const pageUrl = new URL(`/schools/${slug}/one-pager`, url.origin).href;

  try {
    const pdf = await renderSheetPdf(pageUrl);
    const filename = `${school.short.replace(/[^\w-]+/g, "-")}-XtraPoint-One-Pager.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        // Short cache follows school publication without a site rebuild.
        "Cache-Control": "public, max-age=30, must-revalidate",
        "CDN-Cache-Control": "public, max-age=30",
      },
    });
  } catch (err) {
    console.error("one-pager PDF render failed:", err);
    return new Response("PDF generation failed", { status: 500 });
  }
};
