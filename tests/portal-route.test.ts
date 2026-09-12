import assert from "node:assert/strict";
import { before, after, beforeEach, test } from "node:test";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";

// Exercise the real shared page gate with provider fixtures. No network calls
// or live identity/document changes are required to check tenant boundaries.
const fixture = {
  identity: { userId: "user_example", orgId: "org_example", isStaff: false, role: "org:viewer", partnerId: "school.example", schoolSlug: "example" },
  partner: { _id: "school.example", _rev: "revision", name: "Example", slug: "example", portalEnabled: true, clerkOrgId: "org_example" },
  portal: { school: { slug: "example", name: "Example" }, enabled: true, live: false, livePages: { donor: true, ambassador: true } },
  selectors: [] as unknown[],
  reads: [] as unknown[],
};
const globals = globalThis as typeof globalThis & { __xpPortalGateTest?: typeof fixture };
let server: ViteDevServer;
let gatePortal: (context: any, options?: any) => Promise<any>;
before(async () => {
  globals.__xpPortalGateTest = fixture;
  server = await createServer({
    configFile: false, envDir: false, root: resolve(import.meta.dirname, ".."),
    cacheDir: "/private/tmp/xp-portal-route-test-vite",
    resolve: { alias: [
      { find: "@/lib/portalAuth", replacement: "virtual:portal-gate-auth" },
      { find: "@/data/schoolsSource", replacement: "virtual:portal-gate-schools" },
      { find: "@", replacement: resolve(import.meta.dirname, "../src") },
    ] },
    plugins: [{ name: "portal-gate-fixtures", resolveId(id) { if (id.startsWith("virtual:portal-gate-")) return `\0${id}`; }, load(id) {
      if (id === "\0virtual:portal-gate-auth") return `export const getPortalIdentity = async () => globalThis.__xpPortalGateTest.identity;
        export const findPortalPartner = async selector => { globalThis.__xpPortalGateTest.selectors.push(selector); return globalThis.__xpPortalGateTest.partner; };`;
      if (id === "\0virtual:portal-gate-schools") return `export const getSchoolPortalBySlug = async (...args) => { globalThis.__xpPortalGateTest.reads.push(args); return globalThis.__xpPortalGateTest.portal; };
        export const getSchoolByPortalToken = async () => { throw Error('Legacy preview authorization must not load content'); };`;
    } }],
    server: { middlewareMode: true, ws: false, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom",
  });
  ({ gatePortal } = await server.ssrLoadModule("/src/lib/portalRoute.ts"));
});
after(async () => { delete globals.__xpPortalGateTest; await server?.close(); });
beforeEach(() => {
  Object.assign(fixture.identity, { isStaff: false, role: "org:viewer", partnerId: "school.example", orgId: "org_example", schoolSlug: "example" });
  fixture.partner.portalEnabled = true; fixture.portal.enabled = true;
  fixture.selectors.length = 0; fixture.reads.length = 0;
});
const context = (key = "example") => ({ params: { school: key }, locals: {}, url: new URL(`https://portal.example/portal/${key}/preview`), response: { headers: new Headers(), status: 200 } });

test("a bound viewer may preview using the immutable partner ID", async () => {
  const ctx = context(); const result = await gatePortal(ctx, { sessionOnly: true });
  assert.equal(result.ok, true); assert.equal(result.partnerId, "school.example");
  assert.deepEqual(fixture.selectors, [{ school: "example", partnerId: "school.example" }]);
  assert.deepEqual(fixture.reads, [["example", "school.example"]]);
  assert.equal(ctx.response.headers.get("cache-control"), "private, no-store");
});
test("matching slugs do not let a stale organization or unknown role read partner content", async () => {
  for (const change of [{ orgId: "org_unrelated" }, { role: "org:unknown" }, { partnerId: "school.other" }]) {
    const original = { ...fixture.identity }; Object.assign(fixture.identity, change);
    const result = await gatePortal(context());
    assert.equal(result.ok, false); assert.equal(result.response.status, 403);
    assert.equal(fixture.reads.length, 0);
    Object.assign(fixture.identity, original);
  }
});
test("deactivated members get the disabled notice and cannot enter draft previews", async () => {
  fixture.partner.portalEnabled = false; fixture.portal.enabled = false;
  const denied = await gatePortal(context(), { sessionOnly: true });
  assert.equal(denied.ok, false); assert.equal(denied.response.headers.get("location"), "/portal/example");
  const ctx = context(); const root = await gatePortal(ctx, { allowDisabled: true });
  assert.equal(root.ok, true); assert.equal(root.enabled, false); assert.equal(ctx.response.status, 403);
});
test("legacy bearer links cannot access unpublished previews or fetch draft content", async () => {
  const result = await gatePortal(context("a".repeat(32)), { sessionOnly: true });
  assert.equal(result.ok, false); assert.equal(result.response.status, 403);
  assert.equal(result.response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(fixture.selectors, []); assert.deepEqual(fixture.reads, []);
});
