import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { canonicalPartnerId, schoolContent, safeEditorFields, validateSchoolChanges } from "../src/lib/schoolManagement.ts";
import { DEFAULT_AMBASSADOR_TIERS, DEFAULT_AMBASSADOR_PROGRAMS } from "../studio/lib/ambassadorDefaults.ts";

test("an existing school's seeded program entries can roundtrip an unrelated edit", () => {
  const fields = safeEditorFields({
    name: "Example School", short: "Example", mascot: "Eagles", fund: "Eagle Fund",
    ambassadorTiers: DEFAULT_AMBASSADOR_TIERS,
    ambassadorPrograms: DEFAULT_AMBASSADOR_PROGRAMS,
  });
  const changes = validateSchoolChanges({ ...fields, name: "Example University" });
  assert.equal(changes.name, "Example University");
  assert.deepEqual(changes.ambassadorTiers, DEFAULT_AMBASSADOR_TIERS);
  assert.deepEqual(changes.ambassadorPrograms, DEFAULT_AMBASSADOR_PROGRAMS);
});

test("clearing an optional color remains saveable after reloading", () => {
  const cleared = validateSchoolChanges({ theme: { secondary: "" } });
  const fields = safeEditorFields({ name: "Example School", theme: { primary: "#03116d", secondary: cleared["theme.secondary"] } });
  assert.doesNotThrow(() => validateSchoolChanges({ ...fields, name: "New Example School" }));
});

test("ordinary edits cannot change identity, portal credentials or publication state", () => {
  for (const field of ["_id", "slug", "portalToken", "portalEnabled", "clerkOrgId", "productionStatus", "approvedVersion", "livePages"]) {
    assert.throws(() => validateSchoolChanges({ [field]: "modified" }), /cannot be changed/);
  }
});

test("content copying preserves unknown data and assets while retaining live operational authority", () => {
  const logo = { _type: "image", asset: { _type: "reference", _ref: "image-example" } };
  const result = schoolContent({
    _id: "drafts.school.example", _type: "school", _rev: "draft-rev",
    name: "Example", logo, customLegacySettings: { retained: true },
    portalEnabled: false, portalToken: "secret", clerkOrgId: "org_example",
    productionStatus: "draft", approvedVersion: "prior snapshot", approvedAt: "previous",
  });
  assert.deepEqual(result, { name: "Example", logo, customLegacySettings: { retained: true } });
});

test("separate partner IDs do not depend on their duplicate slug", () => {
  assert.notEqual(canonicalPartnerId("school.oregon"), canonicalPartnerId("school.oregon-university"));
  assert.throws(() => canonicalPartnerId("drafts.school.oregon"));
  assert.throws(() => canonicalPartnerId("versions.release.school.oregon"));
});

test("the text allowlist does not admit inherited object properties", () => {
  assert.throws(() => validateSchoolChanges({ constructor: "changed" }), /cannot be changed/);
  assert.throws(() => validateSchoolChanges({ toString: "changed" }), /cannot be changed/);
});

test("logo-size validation accepts only actual string choices", () => {
  assert.throws(() => validateSchoolChanges({ logoSize: ["md"] }));
  assert.deepEqual(validateSchoolChanges({ logoSize: "md" }), { logoSize: "md" });
});

type Doc = Record<string, any> & { _id: string; _rev?: string };
type Operation = { type: string; id: string; doc?: Doc; revision?: string; set?: Record<string, unknown>; unset?: string[] };
const clone = <T>(value: T): T => structuredClone(value);
const conflict = () => Object.assign(new Error("Revision conflict"), { statusCode: 409 });

/** In-memory adapter exercises lifecycle outcomes and all-or-nothing writes.
 * Queries support only the shapes used by the school lifecycle; an unexpected
 * provider request fails the test instead of contacting Sanity or Clerk. */
class MemoryStore {
  docs = new Map<string, Doc>();
  beforeCommit?: () => void;
  revision = 0;
  reset(docs: Doc[]) { this.docs = new Map(docs.map(doc => [doc._id, clone(doc)])); this.beforeCommit = undefined; }
  projection(doc?: Doc) {
    if (!doc) return null;
    return { slug: doc.slug?.current, name: doc.name, short: doc.short, mascot: doc.mascot, fund: doc.fund, logo: doc.logo ?? null };
  }
  async fetch(query: string, params: Record<string, any>) {
    if (query.includes('"live":')) {
      const live = this.docs.get(params.id);
      const draft = this.docs.get(params.draftId);
      return clone({ live: live ?? null, draft: draft ?? null, liveProjection: this.projection(live), draftProjection: this.projection(draft) });
    }
    if (/_type\s*==\s*"schoolRelease"/.test(query)) {
      const releases = [...this.docs.values()].filter(doc => doc._type === "schoolRelease" && doc.partnerId === (params.id ?? params.partnerId));
      return params.releaseId ? clone(releases.find(doc => doc._id === params.releaseId) ?? null) : clone(releases);
    }
    if (params.slug !== undefined) {
      return [...this.docs.values()].find(doc => doc._type === "school" && doc.slug?.current === params.slug && doc._id !== params.id && doc._id !== params.draftId)?._id ?? null;
    }
    throw new Error("Unexpected lifecycle query in test");
  }
  transaction() {
    const operations: Operation[] = [];
    const db = this;
    const tx = {
      create(doc: Doc) { operations.push({ type: "create", id: doc._id, doc: clone(doc) }); return tx; },
      createIfNotExists(doc: Doc) { operations.push({ type: "createIfNotExists", id: doc._id, doc: clone(doc) }); return tx; },
      delete(id: string) { operations.push({ type: "delete", id }); return tx; },
      patch(id: string, patcher: (patch: any) => unknown) {
        const op: Operation = { type: "patch", id, set: {}, unset: [] };
        const patch = {
          ifRevisionId(revision: string) { op.revision = revision; return patch; },
          set(values: Record<string, unknown>) { Object.assign(op.set!, clone(values)); return patch; },
          unset(paths: string[]) { op.unset!.push(...paths); return patch; },
        };
        patcher(patch); operations.push(op); return tx;
      },
      async commit() {
        const concurrentChange = db.beforeCommit; db.beforeCommit = undefined; concurrentChange?.();
        const next = new Map([...db.docs].map(([id, doc]) => [id, clone(doc)]));
        const changed = new Set<string>();
        for (const op of operations) {
          const existing = next.get(op.id);
          if (op.type === "delete") { next.delete(op.id); continue; }
          if (op.type === "createIfNotExists" && existing) continue;
          if (op.type === "create" || op.type === "createIfNotExists") {
            if (existing) throw conflict();
            next.set(op.id, clone(op.doc!)); changed.add(op.id); continue;
          }
          if (!existing || (op.revision && op.revision !== existing._rev)) throw conflict();
          for (const [path, value] of Object.entries(op.set ?? {})) {
            const parts = path.split('.'); let target = existing;
            for (const part of parts.slice(0, -1)) target = target[part] ??= {};
            target[parts.at(-1)!] = clone(value);
          }
          for (const path of op.unset ?? []) {
            const parts = path.split('.'); let target: any = existing;
            for (const part of parts.slice(0, -1)) target = target?.[part];
            if (target) delete target[parts.at(-1)!];
          }
          changed.add(op.id);
        }
        for (const id of changed) if (next.has(id)) next.get(id)!._rev = `test-revision-${++db.revision}`;
        db.docs = next;
      },
    };
    return tx;
  }
}

const db = new MemoryStore();
let server: ViteDevServer;
let lifecycle: Record<string, (...args: any[]) => Promise<any>>;
const testGlobal = globalThis as typeof globalThis & { __xpSchoolTestDb?: MemoryStore };
before(async () => {
  testGlobal.__xpSchoolTestDb = db;
  server = await createServer({
    configFile: false, envDir: false,
    root: resolve(import.meta.dirname, ".."), cacheDir: "/private/tmp/xp-school-lifecycle-test-vite",
    resolve: { alias: [
      { find: "@/config/sanity", replacement: "virtual:school-test-read" },
      { find: "@/config/sanityWrite", replacement: "virtual:school-test-write" },
      { find: "@/data/schoolsSource", replacement: "virtual:school-test-projection" },
      { find: "@", replacement: resolve(import.meta.dirname, "../src") },
    ] },
    plugins: [{
      name: "school-lifecycle-provider-fixtures",
      resolveId(id) { if (id.startsWith("virtual:school-test-")) return `\0${id}`; },
      load(id) {
        if (id === "\0virtual:school-test-read") return 'export const sanityClient = { withConfig: () => ({fetch: (...args) => globalThis.__xpSchoolTestDb.fetch(...args)}) };';
        if (id === "\0virtual:school-test-write") return 'export const writeClient = () => globalThis.__xpSchoolTestDb;';
        if (id === "\0virtual:school-test-projection") return 'export const SCHOOL_PROJECTION_FIELDS = "slug,name,short,mascot,fund,logo";';
      },
    }],
    server: { middlewareMode: true, ws: false, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom",
  });
  lifecycle = await server.ssrLoadModule("/src/data/schoolManagementStore.ts");
});
after(async () => { delete testGlobal.__xpSchoolTestDb; await server?.close(); });

function schoolPairFixture() {
  const live: Doc = {
    _id: "school.example", _rev: "live-revision", _type: "school",
    name: "Example School", short: "Example", mascot: "Eagles", fund: "Eagle Fund", slug: { current: "example" },
    logo: { _type: "image", asset: { _ref: "image-original" } },
    customLegacySettings: { preserved: true }, clerkOrgId: "org_example", portalEnabled: true,
    productionStatus: "live", approvedVersion: JSON.stringify({ slug: "example", name: "Previously approved" }),
  };
  const draft: Doc = { ...clone(live), _id: `drafts.${live._id}`, _rev: "draft-revision", name: "Edited Example School" };
  return { live, draft };
}

test("publishing a removed logo does not leave it behind in canonical content", async () => {
  const { live, draft } = schoolPairFixture(); delete draft.logo; db.reset([live, draft]);
  await lifecycle.publishSchool(live._id, draft._rev, live._rev, { donor: true, ambassador: true }, "staff-user");
  const published = db.docs.get(live._id)!;
  assert.equal(published.logo, undefined);
  assert.equal(published.clerkOrgId, "org_example");
  assert.equal(published.portalEnabled, true);
  assert.deepEqual(published.customLegacySettings, { preserved: true });
  assert.equal(db.docs.has(draft._id), false);
});

test("a draft changed during approval leaves the public snapshot and history untouched", async () => {
  const { live, draft } = schoolPairFixture(); db.reset([live, draft]);
  db.beforeCommit = () => { db.docs.get(draft._id)!._rev = "concurrent-draft-revision"; };
  await assert.rejects(lifecycle.publishSchool(live._id, draft._rev, live._rev, { donor: true, ambassador: true }, "staff-user"), /Revision conflict/);
  assert.deepEqual(db.docs.get(live._id), live);
  assert.equal(db.docs.get(draft._id)!._rev, "concurrent-draft-revision");
  assert.equal([...db.docs.values()].some(doc => doc._type === "schoolRelease" || doc._type === "schoolAudit"), false);
});

test("a legacy draft-only sales preview becomes managed private preparation", async () => {
  const { draft } = schoolPairFixture(); delete draft.managementVersion; db.reset([draft]);
  const result = await lifecycle.createSalesPreview("school.example", draft._rev, "staff-user");
  const prepared = db.docs.get("school.example")!;
  assert.equal(prepared.managementVersion, 2);
  assert.equal(prepared.productionStatus, "draft");
  assert.equal(prepared.portalEnabled, false);
  assert.deepEqual(prepared.logo, draft.logo);
  assert.deepEqual(prepared.customLegacySettings, draft.customLegacySettings);
  assert.equal(typeof result.token, "string");
  assert.equal(db.docs.has(draft._id), true);
});

test("publishing duplicate Oregon slugs rejects without merging or deleting either partner", async () => {
  const { draft } = schoolPairFixture();
  const first = { ...draft, _id: "drafts.school.oregon", slug: { current: "oregon" } };
  const second = { ...clone(first), _id: "drafts.school.oregon-other", name: "Other Oregon" };
  db.reset([first, second]);
  await assert.rejects(lifecycle.publishSchool("school.oregon", first._rev, null, { donor: true, ambassador: true }, "staff-user"), /Another school record/);
  assert.deepEqual([...db.docs.values()], [first, second]);
});
