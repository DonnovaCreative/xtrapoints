// Shared gate for every Marketing Portal route.
//
// The portal is a multi-page dashboard, and the token in the URL is the only
// credential (Stage 0 has no accounts) — so EVERY page has to re-validate it,
// not just the entry point. This puts that in one place: a page calls gatePortal
// and either gets a school back or a Response to return.
//
// It also owns the security headers, so a new page can't accidentally ship
// without noindex or leak the token in a referrer.
import type { APIContext } from "astro";
import type { School } from "@/data/schools";
import { getSchoolByPortalToken } from "@/data/schoolsSource";
import { isWellFormedPortalToken } from "@/lib/portalToken";

export interface PortalContext {
  school: School;
  token: string;
  /** URL prefix every in-portal link is built from: `/portal/<token>`. */
  base: string;
  /**
   * False only on the root route with `allowDisabled` — the school's portal has
   * been switched off and it should render the notice instead of the dashboard.
   */
  enabled: boolean;
}

export type PortalGate = ({ ok: true } & PortalContext) | { ok: false; response: Response };

const notFound = () =>
  new Response(
    "Not found — this portal link isn't valid. It may have been replaced with a newer one; check with your XtraPoint contact.",
    { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
  );

interface Options {
  /**
   * Root route only. A switched-off school still renders there (a "not active"
   * notice naming who to contact), and every other page redirects to it — one
   * explanation, not six.
   */
  allowDisabled?: boolean;
}

export async function gatePortal(
  ctx: Pick<APIContext, "params" | "response">,
  options: Options = {},
): Promise<PortalGate> {
  ctx.response.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Without this the full portal URL (token included) rides along in the Referer
  // header on every outbound click — including to the Sanity CDN for asset
  // downloads. "no-referrer" keeps the token inside this tab.
  ctx.response.headers.set("Referrer-Policy", "no-referrer");

  const token = ctx.params.token;

  // Reject anything that couldn't have come from the generator before querying.
  if (!isWellFormedPortalToken(token)) return { ok: false, response: notFound() };

  let portal;
  try {
    portal = await getSchoolByPortalToken(token);
  } catch (err) {
    console.error("portal lookup failed:", err);
    return {
      ok: false,
      response: new Response("Something went wrong loading this portal. Please try again.", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      }),
    };
  }

  if (!portal) return { ok: false, response: notFound() };

  const base = `/portal/${token}`;

  if (!portal.enabled && !options.allowDisabled) {
    return { ok: false, response: new Response(null, { status: 302, headers: { location: base } }) };
  }

  // Valid link, but XtraPoint has switched this school's portal off. Kept
  // distinct from a 404 on purpose: the school's contact should learn that
  // access was turned off (and who to ask), not that their bookmark is broken.
  if (!portal.enabled) ctx.response.status = 403;

  return { ok: true, school: portal.school, token, base, enabled: portal.enabled };
}
