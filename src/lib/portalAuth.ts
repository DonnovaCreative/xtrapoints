// Which school a signed-in user is allowed to see.
//
// One Clerk **Organization** = one school. The link between them is the
// organization's `publicMetadata.schoolSlug`, which matches the `slug` on the
// Sanity school document.
//
// Why publicMetadata and not the organization's own slug (which would be free to
// read off the session): organization slugs are editable by org admins, so a
// school renaming theirs would silently lose access to their portal.
// publicMetadata is writable only from the backend — i.e. only by us — which is
// what you want from an authorization link. Sanity stays the source of truth for
// content; Clerk only answers "who is this, and which school are they with".
//
// The cost is one Clerk API call per portal request. That's fine at this scale
// (a handful of schools, low traffic). If it ever isn't, the fix is to surface
// `org.public_metadata` in the session token via Clerk's session customization
// and read it straight off `auth()` — no code here would need to change shape.
import type { APIContext } from "astro";

export interface PortalIdentity {
  userId: string;
  /** Slug of the school whose portal this user may open, if any. */
  schoolSlug?: string;
  /** Their role in that organization, e.g. "org:admin". */
  role?: string;
  /**
   * XtraPoint staff: may open ANY school's portal, to help schools with theirs.
   * Comes from `publicMetadata.staff` on the organization — backend-writable
   * only, so it can't be self-granted by an org admin editing their own profile.
   * Deliberately a property of the *organization*, not the user: staff access is
   * a job, and it ends when someone is removed from the staff org.
   */
  isStaff: boolean;
}

/**
 * Resolves the signed-in user's school. Returns undefined when nobody is signed
 * in — callers decide whether that's a redirect to sign-in or a fallback to a
 * legacy token link.
 */
export async function getPortalIdentity(
  ctx: Pick<APIContext, "locals">,
): Promise<PortalIdentity | undefined> {
  const auth = ctx.locals.auth();
  if (!auth?.userId) return undefined;

  const identity: PortalIdentity = { userId: auth.userId, isStaff: false };
  if (auth.orgRole) identity.role = auth.orgRole;
  if (!auth.orgId) return identity; // Signed in, but no organization selected.

  try {
    const { clerkClient } = await import("@clerk/astro/server");
    const org = await clerkClient(ctx as APIContext).organizations.getOrganization({
      organizationId: auth.orgId,
    });
    const slug = org.publicMetadata?.schoolSlug;
    if (typeof slug === "string" && slug) identity.schoolSlug = slug;
    identity.isStaff = org.publicMetadata?.staff === true;
  } catch (err) {
    // A Clerk outage shouldn't read as "this user has no school" in a way that
    // silently 404s them — log it and let the caller send them somewhere honest.
    console.error("Clerk organization lookup failed:", err);
  }

  return identity;
}
