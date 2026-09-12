import assert from "node:assert/strict";
import { test } from "node:test";
import {
  collectAssetDependencies, inventorySchools, partnerIdFor, planSchoolMigration,
  recordHash, replayMigrationEntry, type RawDocument,
} from "../src/lib/schoolMigration.ts";

const planning = { migrationId: "school-management-v2", plannedAt: "2026-09-12T01:00:00.000Z" };
const school = (overrides: Partial<RawDocument> = {}): RawDocument => ({
  _id: "school.test", _type: "school", _rev: "revision-1",
  _createdAt: "2025-01-01T00:00:00Z", _updatedAt: "2026-09-01T00:00:00Z",
  slug: { _type: "slug", current: "test-college", extra: "retain" },
  name: "Test College", productionStatus: "live", livePages: { donor: false, ambassador: true },
  portalToken: "private-legacy-token", previewToken: "private-preview-token",
  approvedVersion: '{ "slug": "test-college", "theme": { "primary": "#abc123" }, "unknown": false }',
  approvedAt: "2026-01-01T00:00:00Z", submittedForReview: false,
  theme: { primary: "#abc123", experimental: { enabled: true } },
  photos: { team: { _type: "image", asset: { _type: "reference", _ref: "image-abc-100x100-png" }, crop: { left: 0.1 }, credit: "School" } },
  ambassadorTiers: [{ _key: "keep-key", name: "Custom", perks: ["A", "B"] }],
  futureFeature: { zero: 0, absent: null, nested: [false, "", { key: "value" }] },
  ...overrides,
});

test("metadata migration preserves every original field, snapshot bytes, IDs and array keys", () => {
  const doc = school();
  const before = JSON.stringify(doc);
  const plan = planSchoolMigration([doc], planning);
  assert.equal(plan.ready, true);
  const migrated = replayMigrationEntry(doc, plan.entries[0]);
  for (const key of Object.keys(doc)) assert.deepEqual(migrated[key], doc[key], key);
  assert.equal(JSON.stringify(doc), before, "input must not be mutated");
  assert.equal(migrated.managementVersion, 2);
  assert.equal(migrated.approvedVersion, doc.approvedVersion);
  assert.equal(migrated.clerkOrgId, undefined, "no inferred Clerk association");
  assert.deepEqual(plan.entries[0].changedPaths, ["/managementMigratedAt", "/managementMigrationId", "/managementVersion"]);
});

test("published and draft content differences are preserved independently", () => {
  const published = school();
  const draft = school({ _id: "drafts.school.test", _rev: "draft-rev", name: "Unpublished new name", slug: { current: "new-slug" }, theme: { primary: "#ffffff" } });
  const plan = planSchoolMigration([published, draft], planning);
  assert.equal(plan.ready, true);
  assert.deepEqual(new Set(plan.entries.map((entry) => entry.partnerId)), new Set(["school.test"]));
  for (const entry of plan.entries) {
    const original = entry.id.startsWith("drafts.") ? draft : published;
    const migrated = replayMigrationEntry(original, entry);
    assert.deepEqual(migrated.slug, original.slug);
    assert.deepEqual(migrated.theme, original.theme);
  }
  const inventory = inventorySchools([published, draft]);
  assert.equal(inventory.partners, 1);
  assert(inventory.draftDifferences[0].changedPaths.includes("/theme/primary"));
  assert(!JSON.stringify(inventory).includes("private-legacy-token"));
});

test("rerunning migration adds no timestamp churn or other changes", () => {
  const doc = school();
  const first = planSchoolMigration([doc], planning);
  const migrated = replayMigrationEntry(doc, first.entries[0]);
  const second = planSchoolMigration([migrated], { migrationId: "later", plannedAt: "2027-01-01T00:00:00Z" });
  assert.deepEqual(second.entries[0].set, {});
  assert.equal(second.entries[0].beforeHash, second.entries[0].afterHash);
  assert.equal(migrated.managementMigrationId, planning.migrationId);
});

test("revision guards and hashes reject concurrent edits, even if revision was accidentally reused", () => {
  const doc = school();
  const entry = planSchoolMigration([doc], planning).entries[0];
  assert.throws(() => replayMigrationEntry({ ...doc, _rev: "new-revision" }, entry), /changed since planning/);
  assert.throws(() => replayMigrationEntry({ ...doc, approvedVersion: "changed" }, entry), /changed since planning/);
  assert.throws(() => replayMigrationEntry(doc, { ...entry, afterHash: "wrong" }), /hash mismatch/);
  assert.throws(() => replayMigrationEntry(doc, { ...entry, set: { productionStatus: "draft" } }), /non-management/);
});

test("slugs may differ within a draft pair but may not belong to different partners", () => {
  const plan = planSchoolMigration([school(), school({ _id: "school.other" })], planning);
  assert.equal(plan.ready, false);
  assert(plan.issues.some((issue) => issue.code === "duplicate_school_slug"));
});

test("mapping must use immutable partner IDs and cannot reassign existing Clerk bindings", () => {
  const doc = school({ clerkOrgId: "org_existing" });
  const conflict = planSchoolMigration([doc], { ...planning, orgByPartnerId: { "school.test": "org_other" } });
  assert.equal(conflict.ready, false);
  assert(conflict.issues.some((issue) => issue.code === "conflicting_clerk_org_binding"));
  assert.equal(conflict.entries[0].set.clerkOrgId, undefined);
  const unknown = planSchoolMigration([doc], { ...planning, orgByPartnerId: { "test-college": "org_existing" } });
  assert(unknown.issues.some((issue) => issue.code === "unknown_mapping_partner"));
});

test("one Clerk org cannot be bound to multiple partner IDs", () => {
  const docs = [school(), school({ _id: "school.other", slug: { current: "other" } })];
  const plan = planSchoolMigration(docs, { ...planning, orgByPartnerId: { "school.test": "org_shared", "school.other": "org_shared" } });
  assert.equal(plan.ready, false);
  assert(plan.issues.some((issue) => issue.code === "clerk_org_bound_to_multiple_partners"));
});

test("explicit association applies to both existing versions without creating a missing version", () => {
  const doc = school({ _id: "drafts.school.test" });
  const plan = planSchoolMigration([doc], { ...planning, orgByPartnerId: { "school.test": "org_test" } });
  assert.equal(plan.entries.length, 1);
  assert.equal(plan.entries[0].set.clerkOrgId, "org_test");
  assert(plan.issues.some((issue) => issue.code === "draft_only_school"));
});

test("unknown schema versions and duplicate raw IDs block writes", () => {
  const doc = school({ managementVersion: 99 });
  const plan = planSchoolMigration([doc, doc], planning);
  assert.equal(plan.ready, false);
  assert(plan.issues.some((issue) => issue.code === "duplicate_document_id"));
  assert(plan.issues.some((issue) => issue.code === "unsupported_management_version"));
});

test("missing slugs and malformed historical snapshots are reported without rewriting data", () => {
  const doc = school({ slug: null, approvedVersion: "unparseable legacy snapshot" });
  const plan = planSchoolMigration([doc], planning);
  assert(plan.issues.some((issue) => issue.code === "missing_slug"));
  assert(plan.issues.some((issue) => issue.code === "invalid_approved_snapshot"));
  assert.equal(replayMigrationEntry(doc, plan.entries[0]).approvedVersion, doc.approvedVersion);
});

test("template overrides and content release versions are retained and never migrated", () => {
  const override = { _id: "tplov-test-custom", _type: "templateOverride", _rev: "rev", schoolSlug: "test-college", fields: [{ _key: "abc", key: "headline", value: "School custom text" }] };
  const release = school({ _id: "versions.release-id.school.test" });
  const docs = [school(), override, release];
  const originalHash = recordHash(docs);
  const plan = planSchoolMigration(docs, planning);
  assert.equal(plan.entries.length, 1);
  assert.equal(recordHash(docs), originalHash);
  assert(plan.issues.some((issue) => issue.code === "release_version_preserved_not_migrated"));
});

test("dependency scan includes raw refs, unknown nested fields and approved snapshot URLs", () => {
  const oldUrl = "https://cdn.sanity.io/images/project/dataset/old-100x100.png";
  const dependencies = collectAssetDependencies(school({ approvedVersion: JSON.stringify({ logo: `${oldUrl}?w=100` }), futureFile: { asset: { _ref: "file-pdf-pdf" } } }));
  assert.deepEqual(dependencies.refs, ["file-pdf-pdf", "image-abc-100x100-png"]);
  assert.deepEqual(dependencies.urls, [oldUrl]);
});

test("hashes ignore object insertion order while preserving array order and nulls", () => {
  assert.equal(recordHash({ a: 1, b: 2 }), recordHash({ b: 2, a: 1 }));
  assert.notEqual(recordHash([1, 2]), recordHash([2, 1]));
  assert.notEqual(recordHash({ value: null }), recordHash({}));
  assert.equal(partnerIdFor("drafts.school.test"), "school.test");
  assert.throws(() => partnerIdFor("versions.release.school.test"));
});
