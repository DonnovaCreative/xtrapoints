// Secret-gated DRAFT one-pager PDF at /preview/schools/<slug>/one-pager.pdf.
// Prints the secret-gated draft HTML preview (/preview/schools/<slug>/one-pager)
// to a US-Letter PDF via headless Chromium (shared helper) — so sales can
// download a sell sheet for a school that isn't published yet.
//
// ⚠ Chromium fetches the preview page over HTTP with the secret in the URL, so
// enabling Vercel Deployment Protection on this env would break it (see
// DECISIONS.md). Not CDN-cached — drafts change.
import type { APIRoute } from "astro";
import { getSchoolDraft } from "@/data/schoolsSource";
import { previewUnauthorized } from "@/lib/previewGuard";
import { renderSheetPdf } from "@/lib/printSheet";

export const prerender = false;

export const GET: APIRoute = async ({ params, url }) => {
  const denied = previewUnauthorized(url);
  if (denied) return denied;

  const slug = params.slug;
  const secret = url.searchParams.get("secret") ?? "";
  const school = slug ? await getSchoolDraft(slug) : undefined;
  if (!school) return new Response("Not found", { status: 404 });

  // Chromium renders the secret-gated draft HTML on this same deployment.
  const pageUrl = new URL(
    `/preview/schools/${slug}/one-pager?secret=${encodeURIComponent(secret)}`,
    url.origin,
  ).href;

  try {
    const pdf = await renderSheetPdf(pageUrl);
    const filename = `${school.short.replace(/[^\w-]+/g, "-")}-XtraPoint-One-Pager-DRAFT.pdf`;
    return new Response(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Robots-Tag": "noindex, nofollow",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("draft one-pager PDF render failed:", err);
    return new Response("PDF generation failed", { status: 500 });
  }
};
