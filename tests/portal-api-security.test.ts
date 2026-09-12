import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolve } from "node:path";
import { createServer, type ViteDevServer } from "vite";

// Load the real route modules through the installed Vite TypeScript/alias
// transform. No HTTP server is started, no provider request is permitted.
let server: ViteDevServer;
const routes: Record<string, Record<string, (ctx: unknown) => Promise<Response>>> = {};
const originalFetch = globalThis.fetch;
const previousSecret = process.env.PREVIEW_SECRET;

before(async () => {
  process.env.PREVIEW_SECRET = "legacy-preview-secret";
  globalThis.fetch = async () => { throw new Error("An authorization rejection must not call a provider"); };
  server = await createServer({
    configFile: false,
    envDir: false,
    root: resolve(import.meta.dirname, ".."),
    cacheDir: "/private/tmp/xp-auth-test-vite",
    resolve: { alias: { "@": resolve(import.meta.dirname, "../src") } },
    server: { middlewareMode: true, ws: false, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: "custom",
  });
  for (const name of ["portal-access", "portal-brand", "portal-template"]) {
    routes[name] = await server.ssrLoadModule(`/src/pages/api/${name}.ts`);
  }
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (previousSecret === undefined) delete process.env.PREVIEW_SECRET;
  else process.env.PREVIEW_SECRET = previousSecret;
  await server?.close();
});

function context(name: string, method: string, origin = "https://portal.example", signedIn = false) {
  const url = new URL(`https://portal.example/api/${name}?school=example&template=ambassador-flyer&secret=legacy-preview-secret`);
  const request = new Request(url, {
    method,
    ...(method === "POST" ? {
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ school: "example", template: "ambassador-flyer", secret: "legacy-preview-secret", email: "example@example.com" }),
    } : {}),
  });
  return { url, request, locals: { auth: () => ({ userId: signedIn ? "user_without_staff_org" : null, orgRole: "org:admin" }) } };
}

test("a matching legacy preview secret cannot read or mutate portal APIs without a session", async () => {
  for (const [name, route] of Object.entries(routes)) {
    for (const method of ["GET", "POST"]) {
      const response = await route[method](context(name, method));
      assert.equal(response.status, 401, `${method} ${name}`);
      assert.equal((await response.json()).error, "unauthorized");
    }
  }
});

test("all real mutation routes reject a cross-origin request before provider calls", async () => {
  for (const [name, route] of Object.entries(routes)) {
    const response = await route.POST(context(name, "POST", "https://attacker.example"));
    assert.equal(response.status, 403, name);
    assert.equal((await response.json()).error, "invalid_origin");
  }
});

test("a signed-in user without a staff-admin organization cannot manage accounts", async () => {
  for (const method of ["GET", "POST"]) {
    const response = await routes["portal-access"][method](context("portal-access", method, "https://portal.example", true));
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "forbidden");
  }
});
