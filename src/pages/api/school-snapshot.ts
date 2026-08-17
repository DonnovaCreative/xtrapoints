// Resolved content snapshot for one school — what production will serve once
// it's approved.
//
//   GET /api/school-snapshot?school=<slug>&secret=<PREVIEW_SECRET>
//     → 200 { snapshot: "<json>", name, slug }
//     → 404 { error: "not_published" } / 401 / 400
//
// Lives on the site rather than in the Studio so the GROQ projection has exactly
// ONE definition (src/data/schoolsSource.ts). A copy in the Studio would drift
// the first time a field is added, and the failure mode is silent: production
// would quietly serve a snapshot missing the new field.
//
// Read-only — the Studio does the write itself, under the editor's own session,
// so approvals show up in Sanity's document history with a name against them.
export const prerender = false;

import type { APIRoute } from "astro";
import { getSchoolSnapshot } from "@/data/schoolsSource";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CORS });

export const GET: APIRoute = async ({ url }) => {
  const expected = import.meta.env.PREVIEW_SECRET ?? process.env.PREVIEW_SECRET;
  if (!expected || url.searchParams.get("secret") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const slug = url.searchParams.get("school");
  if (!slug) return json({ error: "missing_school" }, 400);

  try {
    const snapshot = await getSchoolSnapshot(slug);
    if (!snapshot) return json({ error: "not_published" }, 404);
    return json({ snapshot: JSON.stringify(snapshot), slug });
  } catch (err) {
    console.error("school-snapshot failed:", err);
    return json({ error: "lookup_failed", message: (err as Error).message }, 502);
  }
};
