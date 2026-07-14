// Secret-gated JSON endpoint that powers the Studio's "Auto-fill from ESPN"
// action. Does the ESPN + College Scorecard lookups server-side (keeps the
// DataGov key off the client, avoids browser CORS on those APIs) and proxies the
// logo bytes so the Studio can upload them under the editor's own session.
//
//   GET /api/seed-college?q=<college>&secret=<PREVIEW_SECRET>
//     → 200 { match, fields, logo }        (single match)
//     → 200 { candidates: [...] }          (needs disambiguation)
//     → 404 { error: "no_match", message } / 401 / 400 / 502
//
// Read-only + gated, so CORS is open (the Studio is a different origin).
export const prerender = false;

import type { APIRoute } from "astro";
import { lookupCollege } from "@/lib/collegeSeed";

const CORS = { "Access-Control-Allow-Origin": "*" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

export const GET: APIRoute = async ({ url }) => {
  const expected = import.meta.env.PREVIEW_SECRET ?? process.env.PREVIEW_SECRET;
  if (!expected || url.searchParams.get("secret") !== expected) {
    return json({ error: "unauthorized" }, 401);
  }

  const q = url.searchParams.get("q")?.trim();
  if (!q) return json({ error: "missing_query", message: "Provide ?q=<college>." }, 400);

  let result;
  try {
    result = await lookupCollege(q);
  } catch (err) {
    return json(
      { error: "lookup_failed", message: err instanceof Error ? err.message : String(err) },
      502,
    );
  }

  if (result.status === "none") {
    return json(
      {
        error: "no_match",
        message: `No ESPN college match for “${q}”. (K-12 / non-football schools aren’t in ESPN — add those manually.)`,
      },
      404,
    );
  }
  if (result.status === "ambiguous") {
    return json({ candidates: result.candidates });
  }

  // Proxy the logo bytes (base64) so the Studio can upload without a CORS-blocked
  // image fetch. Logo is optional — never fail the whole lookup on it.
  let logo: { base64: string; contentType: string; filename: string } | null = null;
  if (result.logoUrl) {
    try {
      const r = await fetch(result.logoUrl);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        const name = new URL(result.logoUrl).pathname.split("/").pop() || "logo.png";
        logo = {
          base64: buf.toString("base64"),
          contentType: r.headers.get("content-type") || "image/png",
          filename: name,
        };
      }
    } catch {
      /* logo optional */
    }
  }

  return json({ match: result.match, fields: result.fields, logo });
};

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CORS });
