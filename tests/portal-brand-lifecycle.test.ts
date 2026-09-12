import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";

type Doc = Record<string, any>;
const initial: Doc = { _id: "school.example", _type: "school", _rev: "live-rev", name: "Example", theme: { primary: "#03116d" }, logo: { asset: { _ref: "retained-logo" } }, clerkOrgId: "org_example", portalEnabled: true, approvedVersion: "published-snapshot" };
let docs = new Map<string, Doc>();
let config: Record<string, unknown> = {};
let revision = 0;
let beforeCommit: (() => void) | undefined;
const clone = <T>(value: T): T => structuredClone(value);
const db = {
  withConfig(value: Record<string, unknown>) { config = value; return db; },
  async getDocument(id: string) { return clone(docs.get(id)); },
  async fetch(_query: string, { id }: { id: string }) {
    assert.equal(config.perspective, "raw", "draft brand queries must opt into the raw perspective");
    const doc = docs.get(id); return doc ? { ...clone(doc), revision: doc._rev, colors: clone(doc.theme) } : null;
  },
  transaction() {
    const operations: ((next: Map<string, Doc>) => void)[] = [];
    const changed = new Set<string>();
    const tx = {
      create(doc: Doc) {
        operations.push(next => { if (next.has(doc._id)) throw Object.assign(Error("Conflict"), { statusCode: 409 }); next.set(doc._id, clone(doc)); changed.add(doc._id); }); return tx;
      },
      patch(id: string, callback: (patch: any) => any) {
        let expected: string | undefined;
        const changes: { action: string; values: any }[] = [];
        const patch = {
          ifRevisionId(value: string) { expected = value; return patch; },
          set(values: Doc) { changes.push({ action: "set", values: clone(values) }); return patch; },
          setIfMissing(values: Doc) { changes.push({ action: "missing", values: clone(values) }); return patch; },
          unset(values: string[]) { changes.push({ action: "unset", values }); return patch; },
        };
        callback(patch);
        operations.push(next => {
          const doc = next.get(id);
          if (!doc || (expected && doc._rev !== expected)) throw Object.assign(Error("Conflict"), { statusCode: 409 });
          for (const change of changes) {
            for (const [path, value] of change.action === "unset" ? change.values.map((path: string) => [path, null]) : Object.entries(change.values)) {
              const parts = path.split("."); let target = doc;
              for (const part of parts.slice(0, -1)) target = target[part] ??= {};
              const key = parts.at(-1)!;
              if (change.action === "unset") delete target[key];
              else if (change.action === "set" || target[key] === undefined) target[key] = clone(value);
            }
          }
          changed.add(id);
        }); return tx;
      },
      async commit() {
        const concurrentChange = beforeCommit; beforeCommit = undefined; concurrentChange?.();
        const next = new Map([...docs].map(([id, doc]) => [id, clone(doc)]));
        for (const operation of operations) operation(next);
        for (const id of changed) next.get(id)!._rev = `revision-${++revision}`;
        docs = next;
      },
    }; return tx;
  },
};
let server: ViteDevServer;
let route: Record<string, (ctx: any) => Promise<Response>>;
const globals = globalThis as typeof globalThis & { __xpBrandLifecycleDb?: typeof db };
before(async () => {
  globals.__xpBrandLifecycleDb = db;
  server = await createServer({ configFile: false, envDir: false, root: resolve(import.meta.dirname, ".."), cacheDir: "/private/tmp/xp-brand-lifecycle-test-vite",
    resolve: { alias: [
      { find: "@/config/sanityWrite", replacement: "virtual:brand-test-write" },
      { find: "@/lib/portalAuth", replacement: "virtual:brand-test-auth" },
      { find: "@", replacement: resolve(import.meta.dirname, "../src") },
    ] },
    plugins: [{ name: "brand-provider-fixtures", resolveId(id) { if (id.startsWith("virtual:brand-test-")) return `\0${id}`; }, load(id) {
      if (id === "\0virtual:brand-test-write") return "export const writeClient = () => globalThis.__xpBrandLifecycleDb;";
      if (id === "\0virtual:brand-test-auth") return 'export const resolvePortalPartner = async () => ({partner:{_id:"school.example"},identity:{userId:"staff-editor"}});';
    } }],
    server: { middlewareMode: true, ws: false, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom",
  });
  route = await server.ssrLoadModule("/src/pages/api/portal-brand.ts");
});
after(async () => { delete globals.__xpBrandLifecycleDb; await server?.close(); });
beforeEach(() => { docs = new Map([[initial._id, clone(initial)]]); config = {}; beforeCommit = undefined; });
function context(body?: Record<string, unknown>) {
  const url = new URL("https://portal.example/api/portal-brand?partnerId=school.example");
  const request = new Request(url, body ? { method: "POST", headers: { Origin: url.origin, "Content-Type": "application/json" }, body: JSON.stringify({ partnerId: "school.example", ...body }) } : {});
  return { url, request, locals: {} };
}

test("brand saves preserve full school content and atomically synchronize review signals", async () => {
  const saved = await route.POST(context({ revision: "live-rev", colors: { primary: "#123456" } }));
  assert.equal(saved.status, 200);
  let draft = docs.get("drafts.school.example")!;
  assert.equal(draft.theme.primary, "#123456"); assert.deepEqual(draft.logo, initial.logo);
  assert.equal(docs.get(initial._id)!.theme.primary, initial.theme.primary);
  assert.equal(docs.get(initial._id)!.approvedVersion, initial.approvedVersion);
  const review = await route.POST(context({ revision: draft._rev, submit: true }));
  assert.equal(review.status, 200);
  assert.equal(docs.get(initial._id)!.reviewStatus, "in_review");
  draft = docs.get("drafts.school.example")!;
  assert.equal(draft.reviewStatus, "in_review"); assert.equal(draft.submittedForReview, true);
  assert.equal([...docs.values()].filter(doc => doc._type === "schoolAudit").length, 2);
  const edited = await route.POST(context({ revision: draft._rev, colors: { primary: "#abcdef" } }));
  assert.equal(edited.status, 200); draft = docs.get("drafts.school.example")!;
  assert.equal(draft.submittedForReview, false); assert.equal(draft.submittedAt, undefined);
  assert.equal(docs.get(initial._id)!.reviewStatus, "draft");
  const current = await route.GET(context()); const data = await current.json();
  assert.equal(data.pending, true); assert.equal(data.colors.primary, "#abcdef");
});
test("stale and concurrently changed brand revisions cannot partly update content or review state", async () => {
  assert.equal((await route.POST(context({ revision: "stale", colors: { primary: "#123456" } }))).status, 409);
  assert.deepEqual([...docs.values()], [initial]);
  beforeCommit = () => { docs.get(initial._id)!._rev = "concurrent"; };
  assert.equal((await route.POST(context({ revision: "live-rev", colors: { primary: "#123456" } }))).status, 409);
  assert.deepEqual([...docs.values()], [{ ...initial, _rev: "concurrent" }]);
});
