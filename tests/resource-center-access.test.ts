import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';

let server: ViteDevServer;
let module: { gateResourceCenter: (context: any) => Promise<Response | undefined>; resourceCenterIsPublic: () => boolean };
const state = { identity: undefined as any, partner: undefined as any, error: false, selector: undefined as any };
const priorFlag = process.env.XP_RESOURCE_CENTER_PUBLIC;
before(async () => {
  delete process.env.XP_RESOURCE_CENTER_PUBLIC;
  (globalThis as any).__xpResourceGateTest = state;
  server = await createServer({ configFile: false, envDir: false, root: resolve(import.meta.dirname, '..'), cacheDir: '/private/tmp/xp-resource-gate-test',
    define: { 'import.meta.env.DEV': 'false', 'import.meta.env.XP_RESOURCE_CENTER_PUBLIC': 'undefined' },
    resolve: { alias: { '@': resolve(import.meta.dirname, '../src') } }, server: { middlewareMode: true, ws: false, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
    plugins: [{ name: 'resource-auth-fixtures', enforce: 'pre', load(id) { if (id.endsWith('/src/lib/portalAuth.ts')) return `export async function getPortalIdentity(){const s=globalThis.__xpResourceGateTest;if(s.error)throw new Error('Provider unavailable');return s.identity} export async function findPortalPartner(selector){const s=globalThis.__xpResourceGateTest;s.selector=selector;return s.partner}`; } }],
  });
  module = await server.ssrLoadModule('/src/data/toolkit/access.ts') as typeof module;
});
after(async () => { if (priorFlag === undefined) delete process.env.XP_RESOURCE_CENTER_PUBLIC; else process.env.XP_RESOURCE_CENTER_PUBLIC = priorFlag; delete (globalThis as any).__xpResourceGateTest; await server?.close(); });
const context = { locals: { auth() {} } };

test('anonymous and uninitialized production requests fail closed until explicit public rollout', async () => {
  state.identity = undefined;
  assert.equal((await module.gateResourceCenter(context))?.status, 404);
  assert.equal((await module.gateResourceCenter({ locals: {} }))?.status, 404);
  for (const value of ['false', '1', 'TRUE']) { process.env.XP_RESOURCE_CENTER_PUBLIC = value; assert.equal(module.resourceCenterIsPublic(), false); }
  process.env.XP_RESOURCE_CENTER_PUBLIC = 'true';
  assert.equal(await module.gateResourceCenter({ locals: {} }), undefined);
  delete process.env.XP_RESOURCE_CENTER_PUBLIC;
});

test('partner access requires enabled portal and matching stable organization identity', async () => {
  state.identity = { userId: 'user', isStaff: false, partnerId: 'school.stable', schoolSlug: 'old-slug', orgId: 'org-one', role: 'org:viewer' };
  state.partner = { _id: 'school.stable', slug: 'renamed-school', name: 'Example School', portalEnabled: true, clerkOrgId: 'org-one' };
  assert.equal(await module.gateResourceCenter(context), undefined);
  assert.deepEqual(state.selector, { partnerId: 'school.stable', school: 'old-slug' });
  state.partner.portalEnabled = false;
  assert.equal((await module.gateResourceCenter(context))?.status, 404);
  state.partner.portalEnabled = true; state.partner.clerkOrgId = 'org-two';
  assert.equal((await module.gateResourceCenter(context))?.status, 404);
  state.partner.clerkOrgId = 'org-one'; state.partner._id = 'school.other';
  assert.equal((await module.gateResourceCenter(context))?.status, 404);
});

test('authorized staff retain preview access and provider outages never grant it', async () => {
  state.identity = { userId: 'staff', isStaff: true };
  assert.equal(await module.gateResourceCenter(context), undefined);
  state.error = true;
  const response = await module.gateResourceCenter(context);
  assert.equal(response?.status, 503);
  assert.equal(response?.headers.get('Cache-Control'), 'private, no-store');
  state.error = false;
});
