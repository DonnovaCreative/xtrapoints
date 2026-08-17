// Powers the Studio's "Portal access" panel on a school (see
// studio/components/PortalAccessInput.tsx). One endpoint, because setting a
// school up is one job:
//
//   GET  /api/portal-access?school=<slug>&secret=…   → who has access today
//   POST /api/portal-access  { school, email, secret } → invite someone
//   POST … { school, revokeInvitation: <id>, secret }  → cancel a pending invite
//
// The organization is created on the first invite and linked to the school by
// publicMetadata.schoolSlug, so there's no separate "create the org" step to
// forget. Everything here needs CLERK_SECRET_KEY, which is why it lives on the
// site and not in the Studio bundle — the Studio is a public JS bundle.
//
// Gated by PREVIEW_SECRET, the same shared secret the Studio already uses for
// its other privileged action (see api/seed-college.ts). CORS is open because
// the Studio is a different origin; the secret is what actually guards it.
export const prerender = false;

import type { APIRoute } from "astro";
import { createClerkClient } from "@clerk/astro/server";
import { getSchool } from "@/data/schoolsSource";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
  });

export const OPTIONS: APIRoute = () => new Response(null, { status: 204, headers: CORS });

const secretOk = (given: string | null) => {
  const expected = import.meta.env.PREVIEW_SECRET ?? process.env.PREVIEW_SECRET;
  return Boolean(expected) && given === expected;
};

const clerk = () => {
  const secretKey = import.meta.env.CLERK_SECRET_KEY ?? process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error("CLERK_SECRET_KEY is not configured");
  return createClerkClient({ secretKey });
};

/** The organization mapped to this school, if one exists yet. */
async function findOrg(schoolSlug: string) {
  const client = clerk();
  // Clerk has no "query organizations by metadata" filter, so this scans. Fine
  // at partner-portal scale (tens of orgs); revisit if it ever isn't.
  const { data } = await client.organizations.getOrganizationList({ limit: 500 });
  return data.find((o) => o.publicMetadata?.schoolSlug === schoolSlug);
}

/** Everyone who can currently open this school's portal, plus pending invites. */
async function accessState(schoolSlug: string) {
  const org = await findOrg(schoolSlug);
  if (!org) return { org: null, members: [], invitations: [] };

  const client = clerk();
  const [members, invitations] = await Promise.all([
    client.organizations.getOrganizationMembershipList({ organizationId: org.id, limit: 100 }),
    client.organizations.getOrganizationInvitationList({
      organizationId: org.id,
      status: ["pending"],
      limit: 100,
    }),
  ]);

  return {
    org: { id: org.id, name: org.name },
    members: members.data.map((m) => ({
      id: m.id,
      email: m.publicUserData?.identifier ?? "",
      name: [m.publicUserData?.firstName, m.publicUserData?.lastName].filter(Boolean).join(" "),
      role: m.role,
    })),
    invitations: invitations.data.map((i) => ({
      id: i.id,
      email: i.emailAddress,
      createdAt: i.createdAt,
    })),
  };
}

export const GET: APIRoute = async ({ url }) => {
  if (!secretOk(url.searchParams.get("secret"))) return json({ error: "unauthorized" }, 401);
  const schoolSlug = url.searchParams.get("school");
  if (!schoolSlug) return json({ error: "missing_school" }, 400);

  try {
    return json(await accessState(schoolSlug));
  } catch (err) {
    console.error("portal-access GET failed:", err);
    return json({ error: "clerk_failed", message: (err as Error).message }, 502);
  }
};

export const POST: APIRoute = async ({ request }) => {
  let body: {
    secret?: string;
    school?: string;
    email?: string;
    revokeInvitation?: string;
    removeMember?: string;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  if (!secretOk(body.secret ?? null)) return json({ error: "unauthorized" }, 401);
  const schoolSlug = body.school;
  if (!schoolSlug) return json({ error: "missing_school" }, 400);

  try {
    const client = clerk();

    if (body.revokeInvitation) {
      const org = await findOrg(schoolSlug);
      if (!org) return json({ error: "no_org" }, 404);
      await client.organizations.revokeOrganizationInvitation({
        organizationId: org.id,
        invitationId: body.revokeInvitation,
      });
      return json(await accessState(schoolSlug));
    }

    if (body.removeMember) {
      const org = await findOrg(schoolSlug);
      if (!org) return json({ error: "no_org" }, 404);
      await client.organizations.deleteOrganizationMembership({
        organizationId: org.id,
        userId: body.removeMember,
      });
      return json(await accessState(schoolSlug));
    }

    const email = body.email?.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: "bad_email" }, 400);
    }

    // The school has to exist and be published first — otherwise we'd invite
    // someone into a portal whose pages 404.
    const school = await getSchool(schoolSlug);
    if (!school) return json({ error: "school_not_published" }, 409);

    // Create the organization on first invite, so there's no separate setup step.
    let org = await findOrg(schoolSlug);
    if (!org) {
      org = await client.organizations.createOrganization({
        name: school.name,
        publicMetadata: { schoolSlug },
      });
    }

    await client.organizations.createOrganizationInvitation({
      organizationId: org.id,
      emailAddress: email,
      role: "org:member",
      // Land them straight in their portal after they accept.
      redirectUrl: new URL(`/portal/${schoolSlug}`, import.meta.env.SITE ?? "https://xtrapoint.com")
        .href,
    });

    return json(await accessState(schoolSlug));
  } catch (err) {
    const message = (err as Error).message ?? "";
    // Clerk 422s a duplicate invite; that's not an error worth alarming anyone.
    if (/already|duplicate/i.test(message)) {
      return json({ error: "already_invited", message }, 409);
    }
    console.error("portal-access POST failed:", err);
    return json({ error: "clerk_failed", message }, 502);
  }
};
