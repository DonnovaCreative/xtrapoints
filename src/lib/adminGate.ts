import type { APIContext } from "astro";
import { getPortalIdentity } from "@/lib/portalAuth";
import { canAdministerPartners } from "@/lib/portalPermissions";
export async function gateAdmin(
  ctx: APIContext & { response: { headers: Headers } },
): Promise<Response | null> {
  const privateHeaders = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };
  ctx.response.headers.set("Cache-Control", "private, no-store");
  ctx.response.headers.set("X-Robots-Tag", "noindex, nofollow");
  ctx.response.headers.set("Referrer-Policy", "no-referrer");
  try {
    const identity = await getPortalIdentity(ctx);
    if (!identity)
      return new Response(null, {
        status: 302,
        headers: { ...privateHeaders, Location: `/sign-in?redirect_url=${encodeURIComponent(ctx.url.pathname)}` },
      });
    if (!canAdministerPartners(identity))
      return new Response(null, {
        status: 302,
        headers: { ...privateHeaders, Location: "/portal?switch=1&reason=admin" },
      });
    return null;
  } catch {
    return new Response("Account verification is temporarily unavailable. Please try again.", {
      status: 503,
      headers: privateHeaders,
    });
  }
}
