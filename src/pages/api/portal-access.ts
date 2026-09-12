// Staff account administration lives in the application, authorized by a Clerk
// staff-admin session. A preview secret never grants member-management access.
export const prerender = false;

import type { APIRoute, APIContext } from "astro";
import { createClerkClient } from "@clerk/astro/server";
import { createHash } from "node:crypto";
import { getPortalIdentity, findPortalPartner } from "@/lib/portalAuth";
import { writeClient } from "@/config/sanityWrite";
import {
  canAdministerPartners, collectPaginated, isPartnerRole, isRecord,
  portalJson as json, requireSameOrigin, type PortalPartner,
} from "@/lib/portalPermissions";

const clerk = () => {
  const secretKey = import.meta.env.CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not configured");
  return createClerkClient({ secretKey });
};
type Clerk = ReturnType<typeof clerk>;
type Organization = Awaited<ReturnType<Clerk["organizations"]["getOrganization"]>>;

async function requireStaff(ctx: APIContext): Promise<Response | null> {
  try {
    const identity = await getPortalIdentity(ctx);
    if (!identity) return json({ error: "unauthorized" }, 401);
    if (!canAdministerPartners(identity)) return json({ error: "forbidden", message: "Staff administrator access is required." }, 403);
    return null;
  } catch (err) {
    console.error("portal-access identity lookup failed:", err);
    return json({ error: "authorization_unavailable", message: "Access couldn't be checked. Please try again." }, 503);
  }
}

function matchesPartner(org: Organization, partner: PortalPartner): boolean {
  if (org.publicMetadata?.staff === true) return false;
  const id = org.publicMetadata?.partnerId;
  return typeof id === "string" && id ? id === partner._id : org.publicMetadata?.schoolSlug === partner.slug;
}

/** Stored IDs make normal lookup direct. Pagination is only a legacy fallback. */
async function findOrg(client: Clerk, partner: PortalPartner): Promise<Organization | undefined> {
  if (partner.clerkOrgId) {
    const org = await client.organizations.getOrganization({ organizationId: partner.clerkOrgId });
    if (!matchesPartner(org, partner)) throw new Error("Partner organization mapping conflicts with Clerk metadata");
    return org;
  }
  const organizations = await collectPaginated((page) => client.organizations.getOrganizationList({ ...page, orderBy: "+created_at" }));
  const matches = organizations.filter((org) => matchesPartner(org, partner));
  if (matches.length > 1) throw new Error("Multiple organizations are mapped to this partner");
  return matches[0];
}

async function persistMapping(client: Clerk, partner: PortalPartner, org: Organization) {
  // Partial metadata update preserves unrelated operational metadata.
  if (org.publicMetadata?.partnerId !== partner._id || org.publicMetadata?.schoolSlug !== partner.slug) {
    await client.organizations.updateOrganizationMetadata(org.id, {
      publicMetadata: { partnerId: partner._id, schoolSlug: partner.slug },
    });
  }
  if (partner.clerkOrgId !== org.id) {
    // A competing mapping must never silently win. The deterministic Clerk slug
    // below prevents duplicate newly-provisioned orgs during concurrent invites.
    await writeClient().patch(partner._id).ifRevisionId(partner._rev).set({ clerkOrgId: org.id }).commit();
  }
}

async function organizationForInvite(client: Clerk, partner: PortalPartner): Promise<Organization> {
  let org = await findOrg(client, partner);
  if (!org) {
    const slug = `xp-${createHash("sha256").update(partner._id).digest("hex").slice(0, 24)}`;
    try {
      org = await client.organizations.createOrganization({
        name: partner.name,
        slug,
        publicMetadata: { partnerId: partner._id, schoolSlug: partner.slug },
      });
    } catch (err) {
      // Another request may have just created the same organization. Recover by
      // its unique deterministic slug and verify identity before using it.
      const existing = await client.organizations.getOrganization({ slug }).catch(() => undefined);
      if (!existing || !matchesPartner(existing, partner)) throw err;
      org = existing;
    }
  }
  await persistMapping(client, partner, org);
  return org;
}

async function membersFor(client: Clerk, organizationId: string) {
  return collectPaginated((page) => client.organizations.getOrganizationMembershipList({ organizationId, ...page }));
}

async function accessState(client: Clerk, partner: PortalPartner, selected?: Organization) {
  const org = selected ?? await findOrg(client, partner);
  if (!org) return { partnerId: partner._id, org: null, members: [], invitations: [] };
  const [members, invitations] = await Promise.all([
    membersFor(client, org.id),
    collectPaginated((page) => client.organizations.getOrganizationInvitationList({ organizationId: org.id, status: ["pending"], ...page })),
  ]);
  return {
    partnerId: partner._id,
    org: { id: org.id, name: org.name },
    members: members.map((m) => ({
      id: m.id,
      userId: m.publicUserData?.userId ?? "",
      email: m.publicUserData?.identifier ?? "",
      name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" "),
      role: m.role,
    })),
    invitations: invitations.map((i) => ({ id: i.id, email: i.emailAddress, createdAt: i.createdAt, role: i.role })),
  };
}

const failure = (err: unknown) => {
  console.error("portal-access operation failed:", err);
  const status = isRecord(err) ? err.statusCode ?? err.status : undefined;
  if (status === 409) return json({ error: "conflict", message: "Partner details changed. Refresh and try again." }, 409);
  return json({ error: "clerk_failed", message: "The account change could not be completed. Refresh to check its current status before trying again." }, 502);
};

export const GET: APIRoute = async (ctx) => {
  const denied = await requireStaff(ctx);
  if (denied) return denied;
  const school = ctx.url.searchParams.get("school") ?? undefined;
  const partnerId = ctx.url.searchParams.get("partnerId") ?? undefined;
  if (!school && !partnerId) return json({ error: "missing_school" }, 400);
  try {
    const partner = await findPortalPartner({ school, partnerId });
    if (!partner) return json({ error: "no_such_school" }, 404);
    return json(await accessState(clerk(), partner));
  } catch (err) {
    return failure(err);
  }
};

export const POST: APIRoute = async (ctx) => {
  const originError = requireSameOrigin(ctx.request, ctx.url);
  if (originError) return originError;
  const denied = await requireStaff(ctx);
  if (denied) return denied;

  let body: Record<string, unknown>;
  try {
    const parsed = await ctx.request.json();
    if (!isRecord(parsed)) return json({ error: "bad_json" }, 400);
    body = parsed;
  } catch {
    return json({ error: "bad_json" }, 400);
  }
  const school = typeof body.school === "string" ? body.school : undefined;
  const partnerId = typeof body.partnerId === "string" ? body.partnerId : undefined;
  if (!school && !partnerId) return json({ error: "missing_school" }, 400);
  // Preserve legacy payload names while the application UI adopts explicit actions.
  const action = body.action ?? (body.revokeInvitation ? "revokeInvitation" : body.removeMember ? "removeMember" : "invite");
  if (!["invite", "revokeInvitation", "removeMember", "setRole"].includes(String(action))) return json({ error: "bad_action" }, 400);

  try {
    const partner = await findPortalPartner({ school, partnerId });
    if (!partner) return json({ error: "no_such_school" }, 404);
    const client = clerk();
    if (action === "invite") {
      const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
      if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "bad_email" }, 400);
      const role = body.role ?? "org:member";
      if (!isPartnerRole(role)) return json({ error: "bad_role" }, 400);
      const org = await organizationForInvite(client, partner);
      const state = await accessState(client, partner, org);
      if (state.members.some((m) => m.email.toLowerCase() === email) || state.invitations.some((i) => i.email.toLowerCase() === email)) {
        return json({ error: "already_invited", message: "This person is already a member or has a pending invitation." }, 409);
      }
      await client.organizations.createOrganizationInvitation({
        organizationId: org.id,
        emailAddress: email,
        role,
        redirectUrl: new URL(`/portal/${encodeURIComponent(partner.slug)}`, ctx.url.origin).href,
      });
      return json(await accessState(client, partner, org));
    }

    const org = await findOrg(client, partner);
    if (!org) return json({ error: "no_org" }, 404);
    if (action === "revokeInvitation") {
      const invitationId = body.invitationId ?? body.revokeInvitation;
      if (typeof invitationId !== "string" || !invitationId) return json({ error: "missing_invitation" }, 400);
      await client.organizations.revokeOrganizationInvitation({ organizationId: org.id, invitationId });
    } else {
      const target = body.userId ?? body.removeMember;
      if (typeof target !== "string" || !target) return json({ error: "missing_user" }, 400);
      const members = await membersFor(client, org.id);
      // Old Studio calls sent a membership ID. Resolve it rather than passing it
      // to Clerk's userId parameter, and verify the member belongs to this org.
      const member = members.find((m) => m.publicUserData?.userId === target || m.id === target);
      const userId = member?.publicUserData?.userId;
      if (!member || !userId) return json({ error: "no_such_member" }, 404);
      if (action === "setRole") {
        if (!isPartnerRole(body.role)) return json({ error: "bad_role" }, 400);
        await client.organizations.updateOrganizationMembership({ organizationId: org.id, userId, role: body.role });
      } else {
        await client.organizations.deleteOrganizationMembership({ organizationId: org.id, userId });
      }
    }
    await persistMapping(client, partner, org);
    return json(await accessState(client, partner, org));
  } catch (err) {
    return failure(err);
  }
};
