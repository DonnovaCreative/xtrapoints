import type { APIContext } from "astro";
import { getPortalIdentity } from "@/lib/portalAuth";
import { canAdministerPartners } from "@/lib/portalPermissions";
export async function gateAdmin(
  ctx: APIContext & { response: { headers: Headers } },
): Promise<Response | null> {
  ctx.response.headers.set("Cache-Control", "private, no-store");
  ctx.response.headers.set("X-Robots-Tag", "noindex, nofollow");
  ctx.response.headers.set("Referrer-Policy", "no-referrer");
  try {
    const identity = await getPortalIdentity(ctx);
    if (!identity)
      return new Response(null, {
        status: 302,
        headers: { Location: `/sign-in?redirect_url=${encodeURIComponent(ctx.url.pathname)}` },
      });
    if (!canAdministerPartners(identity))
      return new Response("Choose your XtraPoint administrator organization to manage schools.", {
        status: 403,
      });
    return null;
  } catch {
    return new Response("Account verification is temporarily unavailable. Please try again.", {
      status: 503,
    });
  }
}
