import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";

const fixture: { identity?: { userId: string; isStaff: boolean; role?: string }; fail?: boolean } = {};
const globals = globalThis as typeof globalThis & { __xpAdminGateTest?: typeof fixture };
let server: ViteDevServer;
let gateAdmin: (context: any) => Promise<Response | null>;
before(async () => {
  globals.__xpAdminGateTest = fixture;
  server = await createServer({
    configFile: false, envDir: false, root: resolve(import.meta.dirname, ".."),
    cacheDir: "/private/tmp/xp-admin-gate-test-vite",
    resolve: { alias: [
      { find: "@/lib/portalAuth", replacement: "virtual:admin-gate-auth" },
      { find: "@", replacement: resolve(import.meta.dirname, "../src") },
    ] },
    plugins: [{ name: "admin-gate-fixture", resolveId(id) { if (id === "virtual:admin-gate-auth") return `\0${id}`; }, load(id) {
      if (id === "\0virtual:admin-gate-auth") return `export const getPortalIdentity = async () => { const f = globalThis.__xpAdminGateTest; if (f.fail) throw Error('unavailable'); return f.identity; };`;
    } }],
    server: { middlewareMode: true, ws: false, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: "custom",
  });
  ({ gateAdmin } = await server.ssrLoadModule("/src/lib/adminGate.ts"));
});
after(async () => { delete globals.__xpAdminGateTest; await server?.close(); });
const context = () => ({ locals: {}, url: new URL("https://example.com/admin/schools"), response: { headers: new Headers() } });
function privateResponse(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
}
test("anonymous administrators sign in with their destination retained", async () => {
  fixture.identity = undefined;
  const response = (await gateAdmin(context()))!;
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/sign-in?redirect_url=%2Fadmin%2Fschools");
  privateResponse(response);
});
test("missing or non-administrator workspaces lead to the chooser without granting access", async () => {
  for (const identity of [
    { userId: "user", isStaff: false },
    { userId: "user", isStaff: false, role: "org:admin" },
    { userId: "user", isStaff: true, role: "org:viewer" },
  ]) {
    fixture.identity = identity;
    const response = (await gateAdmin(context()))!;
    assert.equal(response.status, 302);
    assert.equal(response.headers.get("location"), "/portal?switch=1&reason=admin");
    privateResponse(response);
  }
});
test("staff administrators retain access", async () => {
  fixture.identity = { userId: "user", isStaff: true, role: "org:admin" };
  const ctx = context();
  assert.equal(await gateAdmin(ctx), null);
  assert.equal(ctx.response.headers.get("cache-control"), "private, no-store");
});
test("identity service failures remain closed and uncacheable", async () => {
  fixture.fail = true;
  try {
    const response = (await gateAdmin(context()))!;
    assert.equal(response.status, 503);
    privateResponse(response);
  } finally { fixture.fail = false; }
});
