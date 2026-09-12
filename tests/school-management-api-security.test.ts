import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';

// Exercise the actual endpoints, portalAuth and permission policy. Only remote
// Clerk/Sanity reads and the persistence adapter are replaced with fixtures.
// Rejected requests must not reach any management store operation.
let server: ViteDevServer;
const routes: Record<string, { GET: (context: any) => Promise<Response>; POST: (context: any) => Promise<Response> }> = {};
const originalFetch = globalThis.fetch;
const originalSecret = process.env.PREVIEW_SECRET;
const schoolA = { _id: 'school.a', _rev: 'rev-a', slug: 'school-a', name: 'School A', portalEnabled: true, clerkOrgId: 'org-a' };
const schoolB = { _id: 'school.b', _rev: 'rev-b', slug: 'school-b', name: 'School B', portalEnabled: true, clerkOrgId: 'org-b' };
const state = { organizations: {} as Record<string, any>, schools: [schoolA, schoolB] as any[], calls: [] as { name: string; args: any[] }[], authCalls: 0, providerError: false, storeError: null as any };

before(async () => {
  process.env.PREVIEW_SECRET = 'legacy-preview-secret';
  (globalThis as any).__xpSchoolApiSecurityTest = state;
  globalThis.fetch = async () => { throw new Error('School API security tests must not contact a provider'); };
  server = await createServer({
    configFile: false, envDir: false, root: resolve(import.meta.dirname, '..'), cacheDir: '/private/tmp/xp-school-api-security-test',
    resolve: { alias: { '@clerk/astro/server': '/xp-test-clerk.ts', '@': resolve(import.meta.dirname, '../src') } },
    ssr: { noExternal: ['@clerk/astro'] },
    server: { middlewareMode: true, ws: false, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
    plugins: [{ name: 'school-api-provider-fixtures', enforce: 'pre',
      resolveId(id) { if (id === '/xp-test-clerk.ts') return id; },
      load(id) {
        if (id === '/xp-test-clerk.ts') return `export function clerkClient(){return {organizations:{async getOrganization({organizationId}){const s=globalThis.__xpSchoolApiSecurityTest;if(s.providerError)throw new Error('Provider unavailable');return s.organizations[organizationId]||{publicMetadata:{}}}}}}`;
        if (id.endsWith('/src/config/sanity.ts')) return `export const sanityClient={async fetch(query,params){const s=globalThis.__xpSchoolApiSecurityTest;if(s.providerError)throw new Error('Provider unavailable');return s.schools.find(p=>(!params.id||p._id===params.id)&&(!params.slug||p.slug===params.slug))||null}};`;
        if (id.endsWith('/src/data/schoolManagementStore.ts')) return ['listManagedSchools', 'schoolEditor', 'createManagedSchool', 'saveSchool', 'publishSchool', 'createSalesPreview', 'restoreSchoolRelease', 'updateSchoolStatus', 'prepareSchoolHandoff', 'setSchoolReview'].map(name => `export async function ${name}(...args){const s=globalThis.__xpSchoolApiSecurityTest;s.calls.push({name:'${name}',args});if(s.storeError)throw s.storeError;return {ok:true,operation:'${name}'}}`).join('\n');
      },
    }],
  });
  for (const name of ['admin-schools', 'portal-school']) routes[name] = await server.ssrLoadModule(`/src/pages/api/${name}.ts`) as typeof routes[string];
});
beforeEach(() => {
  state.organizations = {
    'org-a': { publicMetadata: { partnerId: 'school.a', schoolSlug: 'outdated-slug' } },
    'org-b': { publicMetadata: { partnerId: 'school.b', schoolSlug: 'school-b' } },
    'org-staff': { publicMetadata: { staff: true } },
  };
  state.schools = [structuredClone(schoolA), structuredClone(schoolB)];
  state.calls = []; state.authCalls = 0; state.providerError = false; state.storeError = null;
});
after(async () => {
  globalThis.fetch = originalFetch;
  if (originalSecret === undefined) delete process.env.PREVIEW_SECRET; else process.env.PREVIEW_SECRET = originalSecret;
  delete (globalThis as any).__xpSchoolApiSecurityTest;
  await server?.close();
});

type Session = { userId: string; orgId?: string; orgRole?: string } | undefined;
const session = (role = 'org:admin', orgId = 'org-a'): Session => ({ userId: `user-${orgId}`, orgId, orgRole: role });
function context(endpoint: string, method = 'GET', auth?: Session, body: any = {}, options: { origin?: string; school?: string; partnerId?: string } = {}) {
  const url = new URL(`https://portal.example/api/${endpoint}`);
  url.searchParams.set('secret', 'legacy-preview-secret');
  url.searchParams.set('school', options.school ?? 'school-a');
  if (options.partnerId) url.searchParams.set('partnerId', options.partnerId);
  const request = new Request(url, { method, ...(method === 'POST' ? { headers: { origin: options.origin ?? url.origin, 'content-type': 'application/json' }, body: JSON.stringify({ school: 'school-a', partnerId: 'school.a', revision: 'draft-rev', publishedRevision: 'live-rev', secret: 'legacy-preview-secret', ...body }) } : {}) });
  return { url, request, locals: { auth: () => { state.authCalls++; return auth; } } };
}
const publish = { action: 'publish', partnerApproved: true, livePages: { donor: true, ambassador: false } };
const assertNoStore = () => assert.deepEqual(state.calls, [], 'An unauthorized request reached the management store');

test('global school list and individual admin records require a staff administrator; shared secrets grant nothing', async () => {
  for (const auth of [undefined, session('org:admin'), session('org:viewer', 'org-staff'), session('org:editor', 'org-staff'), { userId: 'signed-in-without-org' }]) {
    for (const partnerId of [undefined, 'school.b']) {
      const response = await routes['admin-schools'].GET(context('admin-schools', 'GET', auth, {}, { partnerId }));
      assert.equal(response.status, 403); assertNoStore();
      assert.equal(response.headers.get('cache-control'), 'private, no-store');
    }
  }
});

test('all global school mutations reject partner administrators before accessing the store', async () => {
  for (const auth of [undefined, session('org:admin'), session('org:member', 'org-staff')]) {
    for (const action of ['create', 'save', 'preview', 'prepare', 'publish', 'restore', 'access', 'pause']) {
      const response = await routes['admin-schools'].POST(context('admin-schools', 'POST', auth, { ...publish, action, enabled: true }));
      assert.equal(response.status, 403, action); assertNoStore();
    }
  }
});

test('staff administrators can list and inspect schools through the actual admin endpoint', async () => {
  const auth = session('org:admin', 'org-staff');
  assert.equal((await routes['admin-schools'].GET(context('admin-schools', 'GET', auth))).status, 200);
  assert.equal(state.calls[0].name, 'listManagedSchools');
  state.calls = [];
  assert.equal((await routes['admin-schools'].GET(context('admin-schools', 'GET', auth, {}, { partnerId: 'school.b' }))).status, 200);
  assert.deepEqual(state.calls, [{ name: 'schoolEditor', args: ['school.b'] }]);
});

test('both mutation endpoints reject cross-origin requests before resolving identity or storing data', async () => {
  for (const name of Object.keys(routes)) {
    const response = await routes[name].POST(context(name, 'POST', session('org:admin', 'org-staff'), publish, { origin: 'https://attacker.example' }));
    assert.equal(response.status, 403); assert.equal((await response.json()).error, 'invalid_origin');
    assertNoStore(); assert.equal(state.authCalls, 0);
  }
});

test('partner viewers can read their school but cannot save, request review, publish or restore', async () => {
  const auth = session('org:viewer');
  assert.equal((await routes['portal-school'].GET(context('portal-school', 'GET', auth))).status, 200);
  assert.deepEqual(state.calls, [{ name: 'schoolEditor', args: ['school.a'] }]);
  state.calls = [];
  for (const action of ['save', 'review', 'publish', 'restore']) {
    const response = await routes['portal-school'].POST(context('portal-school', 'POST', auth, { ...publish, action }));
    assert.equal(response.status, 403, action); assertNoStore();
  }
});

test('partner editors can save and request review but cannot publish or restore', async () => {
  const auth = session('org:editor');
  assert.equal((await routes['portal-school'].POST(context('portal-school', 'POST', auth, { action: 'save', fields: { name: 'Reviewed change' } }))).status, 200);
  assert.deepEqual(state.calls[0], { name: 'saveSchool', args: ['school.a', 'draft-rev', { name: 'Reviewed change' }, 'user-org-a'] });
  assert.equal((await routes['portal-school'].POST(context('portal-school', 'POST', auth, { action: 'review' }))).status, 200);
  assert.equal(state.calls[1].name, 'setSchoolReview');
  state.calls = [];
  for (const action of ['publish', 'restore']) {
    const response = await routes['portal-school'].POST(context('portal-school', 'POST', auth, { ...publish, action }));
    assert.equal(response.status, 403); assertNoStore();
  }
});

test('a school administrator publishes only its resolved school; a supplied partnerId cannot redirect the mutation', async () => {
  const response = await routes['portal-school'].POST(context('portal-school', 'POST', session(), { ...publish, partnerId: 'school.b' }));
  assert.equal(response.status, 200);
  assert.deepEqual(state.calls, [{ name: 'publishSchool', args: ['school.a', 'draft-rev', 'live-rev', publish.livePages, 'user-org-a'] }]);
  state.calls = [];
  assert.equal((await routes['portal-school'].POST(context('portal-school', 'POST', session(), { ...publish, school: 'school-b' }))).status, 403);
  assertNoStore();
});

test('organization binding, immutable partner identity and disabled portals all block publication', async () => {
  state.schools[0].clerkOrgId = 'org-b';
  assert.equal((await routes['portal-school'].POST(context('portal-school', 'POST', session(), publish))).status, 403); assertNoStore();
  state.schools[0].clerkOrgId = 'org-a'; state.schools[0].portalEnabled = false;
  assert.equal((await routes['portal-school'].POST(context('portal-school', 'POST', session(), publish))).status, 403); assertNoStore();
  state.schools[0].portalEnabled = true;
  state.organizations['org-a'].publicMetadata = { partnerId: 'school.b', schoolSlug: 'school-a' };
  assert.equal((await routes['portal-school'].POST(context('portal-school', 'POST', session(), publish))).status, 403); assertNoStore();
});

test('publication requires an explicit approval choice and boolean page switches', async () => {
  for (const name of Object.keys(routes)) {
    const auth = name === 'admin-schools' ? session('org:admin', 'org-staff') : session();
    for (const body of [{ ...publish, partnerApproved: false }, { ...publish, partnerApproved: 'true' }, { ...publish, livePages: { donor: 'true', ambassador: false } }]) {
      const response = await routes[name].POST(context(name, 'POST', auth, body));
      assert.equal(response.status, 400); assertNoStore();
    }
  }
});

test('anonymous partner requests and provider outages fail closed with no management calls', async () => {
  for (const method of ['GET', 'POST'] as const) {
    assert.equal((await routes['portal-school'][method](context('portal-school', method, undefined, publish))).status, 401);
    assertNoStore();
  }
  state.providerError = true;
  assert.equal((await routes['admin-schools'].GET(context('admin-schools', 'GET', session('org:admin', 'org-staff')))).status, 503);
  assert.equal((await routes['portal-school'].POST(context('portal-school', 'POST', session(), publish))).status, 503);
  assertNoStore();
});

test('store revision conflicts return a reviewable 409 without exposing provider details', async () => {
  state.storeError = { statusCode: 409, message: 'sensitive internal provider diagnostic' };
  for (const name of Object.keys(routes)) {
    const auth = name === 'admin-schools' ? session('org:admin', 'org-staff') : session();
    const response = await routes[name].POST(context(name, 'POST', auth, { action: 'save', fields: { name: 'A change' } }));
    assert.equal(response.status, 409);
    assert.doesNotMatch(await response.text(), /sensitive internal provider diagnostic/);
  }
});
