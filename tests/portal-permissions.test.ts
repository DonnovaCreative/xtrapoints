import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canAccessPartner, canAdministerPartners, collectPaginated, portalJson,
  requireSameOrigin, type PermissionIdentity, type PortalPartner,
} from "../src/lib/portalPermissions.ts";

const partner: PortalPartner = { _id: "school.immutable", _rev: "rev-1", slug: "school-new-name", name: "Example School", portalEnabled: true };
const member: PermissionIdentity = { isStaff: false, role: "org:member", schoolSlug: partner.slug, orgId: "org-school" };

test("legacy members retain editing only within their active partner", () => {
  assert.equal(canAccessPartner(member, partner, "edit"), true);
  assert.equal(canAccessPartner({ ...member, schoolSlug: "another-school" }, partner, "edit"), false);
  assert.equal(canAccessPartner(member, { ...partner, portalEnabled: false }, "edit"), false);
  assert.equal(canAccessPartner(member, { ...partner, portalEnabled: undefined }, "edit"), false);
});

test("stable partner IDs survive a rename and never fall back when mismatched", () => {
  assert.equal(canAccessPartner({ ...member, partnerId: partner._id, schoolSlug: "old-name" }, partner, "edit"), true);
  assert.equal(canAccessPartner({ ...member, partnerId: "school.other" }, partner, "edit"), false);
});

test("a persisted organization mapping rejects another organization's membership", () => {
  const mapped = { ...partner, clerkOrgId: "org-school" };
  assert.equal(canAccessPartner(member, mapped, "edit"), true);
  assert.equal(canAccessPartner({ ...member, orgId: "org-other", partnerId: partner._id }, mapped, "edit"), false);
});

test("viewers may read but cannot write; editors and admins may edit", () => {
  const viewer = { ...member, role: "org:viewer" };
  assert.equal(canAccessPartner(viewer, partner, "read"), true);
  assert.equal(canAccessPartner(viewer, partner, "edit"), false);
  assert.equal(canAccessPartner({ ...member, role: "org:editor" }, partner, "edit"), true);
  assert.equal(canAccessPartner({ ...member, role: "org:admin" }, partner, "edit"), true);
  assert.equal(canAccessPartner({ ...member, role: undefined }, partner), false);
  assert.equal(canAccessPartner({ ...member, role: "org:unknown" }, partner, "edit"), false);
});

test("staff administration requires both staff organization and admin role", () => {
  assert.equal(canAdministerPartners(undefined), false);
  assert.equal(canAdministerPartners({ ...member, role: "org:admin" }), false);
  assert.equal(canAdministerPartners({ ...member, isStaff: true }), false);
  assert.equal(canAdministerPartners({ ...member, isStaff: true, role: "org:viewer" }), false);
  assert.equal(canAdministerPartners({ ...member, isStaff: true, role: "org:admin" }), true);
});

test("staff may support disabled partners, but staff viewers cannot edit them", () => {
  const disabled = { ...partner, portalEnabled: false };
  assert.equal(canAccessPartner(member, disabled, "read"), false);
  assert.equal(canAccessPartner({ ...member, isStaff: true, role: "org:admin" }, disabled, "edit"), true);
  assert.equal(canAccessPartner({ ...member, isStaff: true, role: "org:viewer" }, disabled, "edit"), false);
});

const mutation = (headers: Record<string, string>) => new Request("https://portal.example/api/portal-brand", { method: "POST", headers });

test("same-origin browser mutations pass with or without fetch metadata", () => {
  assert.equal(requireSameOrigin(mutation({ origin: "https://portal.example" })), null);
  assert.equal(requireSameOrigin(mutation({ origin: "https://portal.example", "sec-fetch-site": "same-origin" })), null);
});

test("CSRF gate rejects missing, null, sibling-host, wrong-port and cross-site origins", async () => {
  const attempts: Record<string, string>[] = [
    {}, { origin: "null" }, { origin: "https://attacker.example" },
    { origin: "https://sub.portal.example" }, { origin: "https://portal.example:444" },
    { origin: "http://portal.example" },
    { origin: "https://portal.example", "sec-fetch-site": "cross-site" },
  ];
  for (const headers of attempts) {
    const response = requireSameOrigin(mutation(headers));
    assert.equal(response?.status, 403);
    assert.equal((await response!.json()).error, "invalid_origin");
  }
});

test("administrative pagination continues past the former 500-organization ceiling", async () => {
  const source = Array.from({ length: 637 }, (_, i) => i);
  const offsets: number[] = [];
  const result = await collectPaginated(async ({ limit, offset }) => {
    offsets.push(offset);
    return { data: source.slice(offset, offset + limit), totalCount: source.length };
  });
  assert.deepEqual(result, source);
  assert.deepEqual(offsets, [0, 100, 200, 300, 400, 500, 600]);
});

test("pagination handles provider-capped pages and rejects incomplete results", async () => {
  const source = Array.from({ length: 127 }, (_, i) => i);
  const result = await collectPaginated(async ({ offset }) => ({ data: source.slice(offset, offset + 30), totalCount: source.length }));
  assert.deepEqual(result, source);
  await assert.rejects(collectPaginated(async () => ({ data: [], totalCount: 1 })), /Incomplete/);
});

test("private API responses cannot be cached by a shared cache", () => {
  const response = portalJson({ ok: true });
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});
