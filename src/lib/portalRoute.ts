// Shared gate for every Marketing Portal route.
//
// There are TWO ways into a school's portal, and this is the only place that
// knows the difference:
//
//   /portal/<32-hex-token>/…  — Stage 0. The token IS the credential; there's
//                               nothing to log into. Still live so the links
//                               already sent to schools keep working.
//   /portal/<school-slug>/…   — Stage 1. Requires a signed-in Clerk user whose
//                               active organization is mapped to that school
//                               (see src/lib/portalAuth.ts).
//
// Same page files serve both, because what a page needs is a School — not to
// know how the visitor proved they were allowed to see it. Every page has to
// re-validate, not just the entry point, so this puts it in one place: a page
// calls gatePortal and either gets a school back or a Response to return.
//
// It also owns the security headers, so a new page can't accidentally ship
// without noindex or leak a token in a referrer.
import type { APIContext } from "astro";
import type { School } from "@/data/schools";
import { getSchoolByPortalToken, getSchoolPortalBySlug } from "@/data/schoolsSource";
import { isWellFormedPortalToken } from "@/lib/portalToken";
import { getPortalIdentity } from "@/lib/portalAuth";

export interface PortalContext {
  school: School;
  /** URL prefix every in-portal link is built from: `/portal/<token-or-slug>`. */
  base: string;
  /** How this visitor got in — the sidebar shows account controls only to `session`. */
  via: "token" | "session";
  /**
   * True when XtraPoint staff are looking at a school that isn't theirs. The
   * layout says so on screen: someone helping five schools in five tabs should
   * never have to guess whose portal they're in, and it keeps a support
   * screenshot unambiguous.
   */
  staff: boolean;
  /**
   * Approved for production. False means their pages don't exist on
   * xtrapoint.com yet, so the portal has to link them to staging instead of
   * handing a school a 404 of their own landing page.
   */
  live: boolean;
  /**
   * False only on the root route with `allowDisabled` — the school's portal has
   * been switched off and it should render the notice instead of the dashboard.
   */
  enabled: boolean;
}

export type PortalGate = ({ ok: true } & PortalContext) | { ok: false; response: Response };

const text = (body: string, status: number) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8" } });

const notFound = () =>
  text(
    "Not found — this portal link isn't valid. It may have been replaced with a newer one; check with your XtraPoint contact.",
    404,
  );

const redirect = (location: string) =>
  new Response(null, { status: 302, headers: { location } });

interface Options {
  /**
   * Root route only. A switched-off school still renders there (a "not active"
   * notice naming who to contact), and every other page redirects to it — one
   * explanation, not six.
   */
  allowDisabled?: boolean;
}

export async function gatePortal(
  ctx: Pick<APIContext, "params" | "response" | "locals" | "url">,
  options: Options = {},
): Promise<PortalGate> {
  ctx.response.headers.set("X-Robots-Tag", "noindex, nofollow");
  // Without this the full portal URL (token included) rides along in the Referer
  // header on every outbound click — including to the Sanity CDN for asset
  // downloads. "no-referrer" keeps the token inside this tab.
  ctx.response.headers.set("Referrer-Policy", "no-referrer");

  const key = ctx.params.school;
  if (!key) return { ok: false, response: notFound() };

  const base = `/portal/${key}`;
  const isToken = isWellFormedPortalToken(key);

  let school: School | undefined;
  let enabled = false;
  let staff = false;
  let live = false;

  try {
    if (isToken) {
      const portal = await getSchoolByPortalToken(key);
      if (portal) {
        school = portal.school;
        enabled = portal.enabled;
        live = portal.live;
      }
    } else {
      // Slug path: the slug is public (it's in every school's public page URL),
      // so it proves nothing on its own — membership is the credential here.
      const identity = await getPortalIdentity(ctx);

      if (!identity) {
        // Not signed in. Bounce through sign-in and come back to this exact page.
        const back = encodeURIComponent(ctx.url.pathname);
        return { ok: false, response: redirect(`/sign-in?redirect_url=${back}`) };
      }

      // Staff may open any school's portal — that's the job. Everyone else gets
      // exactly the one their organization is mapped to. A 404 would be a lie
      // and a 403 invites probing for which slugs exist, so a mismatch goes to
      // their own portal instead.
      staff = identity.isStaff && identity.schoolSlug !== key;
      if (!identity.isStaff && identity.schoolSlug !== key) {
        return { ok: false, response: redirect("/portal") };
      }

      const portal = await getSchoolPortalBySlug(key);
      school = portal?.school;
      // `portalEnabled` is the deactivation switch for the whole school and it
      // applies however you got here — an account holder of a switched-off
      // school sees the same notice a token visitor does. (Staff are the one
      // exception: they need to see a deactivated portal in order to help.)
      enabled = Boolean(portal) && (staff || portal!.enabled);
      live = portal?.live ?? false;
    }
  } catch (err) {
    console.error("portal lookup failed:", err);
    return {
      ok: false,
      response: text("Something went wrong loading this portal. Please try again.", 500),
    };
  }

  if (!school) return { ok: false, response: notFound() };

  if (!enabled && !options.allowDisabled) {
    return { ok: false, response: redirect(base) };
  }

  // Valid link, but XtraPoint has switched this school's portal off. Kept
  // distinct from a 404 on purpose: the school's contact should learn that
  // access was turned off (and who to ask), not that their bookmark is broken.
  if (!enabled) ctx.response.status = 403;

  return { ok: true, school, base, via: isToken ? "token" : "session", enabled, staff, live };
}
