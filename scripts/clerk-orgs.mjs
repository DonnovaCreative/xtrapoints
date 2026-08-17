// Link a Clerk organization to a Sanity school — the one setup step that makes
// a school's portal reachable by its members.
//
// One Clerk Organization = one school, joined by the org's
// publicMetadata.schoolSlug (see src/lib/portalAuth.ts). It's writable only from
// the backend, which is the point: an org admin can't grant themselves another
// school's portal by editing something in the UI.
//
//   node scripts/clerk-orgs.mjs                                   # list orgs + their links
//   node scripts/clerk-orgs.mjs <org-id|org-slug> <school-slug>   # link one
//   node scripts/clerk-orgs.mjs <org-id|org-slug> --unlink        # remove the link
//   node scripts/clerk-orgs.mjs <org-id|org-slug> --staff         # XtraPoint staff org
//   node scripts/clerk-orgs.mjs <org-id|org-slug> --no-staff      # revoke that
//
// A STAFF org has no school of its own — its members can open every school's
// portal (see src/lib/portalAuth.ts). Keep exactly one, and keep its membership
// tight: it's the widest access in the system.
//
// Reads CLERK_SECRET_KEY from .env. Safe to re-run; linking is idempotent.
//
// Note: only ONE org should hold a given schoolSlug. The script warns if you're
// about to create a duplicate, since two orgs pointing at one school means two
// separate groups of people with access and no obvious sign of it.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { createClerkClient } from "@clerk/astro/server";

// Load .env (Node doesn't, and this runs outside Astro).
const envPath = path.resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
}

const secretKey = process.env.CLERK_SECRET_KEY;
if (!secretKey) {
  console.error("CLERK_SECRET_KEY is not set — add it to .env (see .env.example).");
  process.exit(1);
}

const clerk = createClerkClient({ secretKey });
const [target, schoolSlug] = process.argv.slice(2);

const { data: orgs } = await clerk.organizations.getOrganizationList({ limit: 100 });

if (!target) {
  if (orgs.length === 0) {
    console.log("No organizations yet. Create one in the Clerk dashboard, then re-run.");
  }
  for (const org of orgs) {
    const linked = org.publicMetadata?.schoolSlug;
    const staff = org.publicMetadata?.staff === true;
    console.log(
      `${org.name}\n  id:     ${org.id}\n  slug:   ${org.slug ?? "—"}\n  school: ${
        staff ? "— (STAFF: can open every school)" : (linked ?? "NOT LINKED")
      }\n`,
    );
  }
  console.log("Link one:  node scripts/clerk-orgs.mjs <org-id|org-slug> <school-slug>");
  console.log("Staff org: node scripts/clerk-orgs.mjs <org-id|org-slug> --staff");
  process.exit(0);
}

if (!schoolSlug) {
  console.error("Missing <school-slug>. Usage: node scripts/clerk-orgs.mjs <org> <school-slug>");
  process.exit(1);
}

const org = orgs.find((o) => o.id === target || o.slug === target);
if (!org) {
  console.error(`No organization matching "${target}". Run without arguments to list them.`);
  process.exit(1);
}

if (schoolSlug === "--staff" || schoolSlug === "--no-staff") {
  const staff = schoolSlug === "--staff";
  if (staff && org.publicMetadata?.schoolSlug) {
    // A staff org with a school of its own is ambiguous: gatePortal would treat
    // that one school as "theirs" and every other as a staff view. Keep the two
    // roles apart.
    console.error(
      `"${org.name}" is linked to school "${org.publicMetadata.schoolSlug}".\n` +
        `A staff org shouldn't own a school — unlink it first:\n` +
        `  node scripts/clerk-orgs.mjs ${org.id} --unlink`,
    );
    process.exit(1);
  }
  await clerk.organizations.updateOrganizationMetadata(org.id, {
    publicMetadata: { staff: staff ? true : null },
  });
  console.log(
    staff
      ? `"${org.name}" is now a STAFF org — its members can open every school's portal.`
      : `"${org.name}" is no longer a staff org.`,
  );
  process.exit(0);
}

const unlink = schoolSlug === "--unlink";

if (unlink) {
  // null (not undefined) is what actually clears a key through the metadata API.
  await clerk.organizations.updateOrganizationMetadata(org.id, {
    publicMetadata: { schoolSlug: null },
  });
  console.log(`Unlinked "${org.name}" — its members no longer have a portal.`);
  process.exit(0);
}

const clash = orgs.find((o) => o.id !== org.id && o.publicMetadata?.schoolSlug === schoolSlug);
if (clash) {
  console.error(
    `"${clash.name}" is already linked to "${schoolSlug}".\n` +
      `Two orgs on one school means two separate groups with access. Unlink it first:\n` +
      `  node scripts/clerk-orgs.mjs ${clash.id} --unlink`,
  );
  process.exit(1);
}

// updateOrganizationMetadata deep-merges, so unrelated keys survive.
await clerk.organizations.updateOrganizationMetadata(org.id, {
  publicMetadata: { schoolSlug },
});

console.log(`Linked "${org.name}" → school "${schoolSlug}".`);
console.log(`Its members can now open /portal/${schoolSlug}`);
