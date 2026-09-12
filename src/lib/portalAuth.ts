// Clerk owns identity and organization membership. Immutable Sanity school IDs
// link new organizations to partners; schoolSlug remains a migration fallback.
import type { APIContext } from "astro";
import { sanityClient } from "@/config/sanity";
import { canAccessPartner, portalJson, type PartnerAction, type PortalPartner, type PermissionIdentity } from "./portalPermissions";

export interface PortalIdentity extends PermissionIdentity {
  userId: string;
  orgId?: string;
  partnerId?: string;
  schoolSlug?: string;
  role?: string;
  isStaff: boolean;
}

// A page, its gate and its layout share one request-local identity lookup.
// Weak keys prevent identities from surviving the lifetime of request locals.
const requestIdentities = new WeakMap<object, Promise<PortalIdentity | undefined>>();

export function getPortalIdentity(
  ctx: Pick<APIContext, "locals">,
): Promise<PortalIdentity | undefined> {
  const existing = requestIdentities.get(ctx.locals);
  if (existing) return existing;
  const identity = resolveIdentity(ctx);
  requestIdentities.set(ctx.locals, identity);
  return identity;
}

async function resolveIdentity(ctx: Pick<APIContext, "locals">): Promise<PortalIdentity | undefined> {
  const auth = ctx.locals.auth?.();
  if (!auth?.userId) return undefined;
  const identity: PortalIdentity = { userId: auth.userId, isStaff: false };
  if (auth.orgRole) identity.role = auth.orgRole;
  if (!auth.orgId) return identity;
  identity.orgId = auth.orgId;

  // Errors propagate to callers; unavailable identity data is not empty membership.
  const { clerkClient } = await import("@clerk/astro/server");
  const org = await clerkClient(ctx as APIContext).organizations.getOrganization({ organizationId: auth.orgId });
  identity.isStaff = org.publicMetadata?.staff === true;
  const partnerId = org.publicMetadata?.partnerId;
  const slug = org.publicMetadata?.schoolSlug;
  if (typeof partnerId === "string" && partnerId) {
    identity.partnerId = partnerId;
    // Existing page gates route by slug. Resolve from the ID to retain access
    // after a rename without trusting stale slug metadata.
    const current = await sanityClient.fetch<{ slug?: string } | null>(
      `*[_type == "school" && _id == $id && !(_id in path("drafts.**")) && !(_id in path("versions.**"))][0]{"slug": slug.current}`,
      { id: partnerId },
    );
    if (current?.slug) identity.schoolSlug = current.slug;
  } else if (typeof slug === "string" && slug) {
    identity.schoolSlug = slug;
  }
  return identity;
}

export async function findPortalPartner(selector: { school?: string; partnerId?: string }): Promise<PortalPartner | null> {
  if (!selector.school && !selector.partnerId) return null;
  return sanityClient.fetch<PortalPartner | null>(
    `*[_type == "school" && !(_id in path("drafts.**")) && !(_id in path("versions.**")) &&
      ($id == null || _id == $id) && ($slug == null || slug.current == $slug)][0]{
        _id, _rev, name, "slug": slug.current, portalEnabled, clerkOrgId
      }`,
    { id: selector.partnerId ?? null, slug: selector.school ?? null },
  );
}

export async function resolvePortalPartner(
  ctx: Pick<APIContext, "locals">,
  selector: { school?: string; partnerId?: string },
  action: PartnerAction = "read",
): Promise<{ identity: PortalIdentity; partner: PortalPartner } | { error: Response }> {
  if (!selector.school && !selector.partnerId) return { error: portalJson({ error: "missing_school" }, 400) };
  try {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return { error: portalJson({ error: "unauthorized" }, 401) };
    const partner = await findPortalPartner(selector);
    if (!partner || !canAccessPartner(identity, partner, action)) {
      return { error: portalJson({ error: "forbidden", message: "You don't have access to this partner or action." }, 403) };
    }
    return { identity, partner };
  } catch (err) {
    console.error("Portal authorization lookup failed:", err);
    return { error: portalJson({ error: "authorization_unavailable", message: "Access couldn't be checked. Please try again." }, 503) };
  }
}
