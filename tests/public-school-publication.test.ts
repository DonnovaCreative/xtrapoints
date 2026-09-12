import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { resolve } from 'node:path';
import { createServer, type ViteDevServer } from 'vite';

type Source = { getSchool: (slug: string) => Promise<any>; getSchools: () => Promise<any[]>; getSchoolDraftById: (id: string) => Promise<any> };
const state = { answer: null as any, calls: [] as { query: string; params: any; config: any }[] };
const servers: ViteDevServer[] = [];
const sources: Record<string, Source> = {};
const originalFetch = globalThis.fetch;

before(async () => {
  (globalThis as any).__xpSchoolPublicationTest = state;
  globalThis.fetch = async () => { throw new Error('School publication tests must not call a provider'); };
  for (const production of [false, true]) {
    const server = await createServer({
      configFile: false, envDir: false, root: resolve(import.meta.dirname, '..'),
      cacheDir: `/private/tmp/xp-school-publication-${production ? 'production' : 'preview'}`,
      resolve: { alias: { '@': resolve(import.meta.dirname, '../src') } },
      server: { middlewareMode: true, ws: false, hmr: false, watch: null },
      optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
      plugins: [{ name: 'publication-provider-fixtures', enforce: 'pre', load(id) {
        if (id.endsWith('/src/config/site-env.ts')) return `export const isProduction=${production}; export const shouldNoindex=${!production};`;
        if (id.endsWith('/src/config/sanity.ts')) return `function client(config={}) { return { withConfig(next){ return client({...config,...next}) }, async fetch(query,params){const state=globalThis.__xpSchoolPublicationTest;state.calls.push({query,params,config});return structuredClone(state.answer)} } } export const sanityClient=client();`;
      } }],
    });
    servers.push(server);
    sources[production ? 'production' : 'preview'] = await server.ssrLoadModule('/src/data/schoolsSource.ts') as Source;
  }
});
after(async () => { globalThis.fetch = originalFetch; delete (globalThis as any).__xpSchoolPublicationTest; await Promise.all(servers.map(server => server.close())); });

const approved = {
  slug: 'example-school', name: 'Approved School', short: 'Approved', mascot: 'Otters', fund: 'Approved Fund', city: 'Sample', state: 'NY',
  logo: 'https://cdn.example/approved-logo.svg', avatar: 'https://cdn.example/approved-avatar.png',
  photos: { team: 'https://cdn.example/approved-team.jpg', cutoutSecondary: 'https://cdn.example/approved-cutout.png' },
  photoCredits: { team: 'Approved photographer credit' },
  videoUrl: 'https://video.example/approved', videoHeading: 'Approved video', videoCaption: 'Approved caption',
  ambassadorTiers: [{ name: 'Partner-defined tier', role: 'Ambassador', perks: ['Approved benefit'], highlight: true }],
  ambassadorPrograms: [{ title: 'Approved initiative', body: 'Approved explanation' }],
  theme: { primary: '#aaf10a', ink: '#03116d' }, logoSize: 'custom', logoHeight: 72, headerHug: true,
};
function fixture(overrides: Record<string, unknown> = {}) {
  return { ...approved, name: 'Unapproved name', logo: 'https://cdn.example/unapproved-logo.svg', managementVersion: 2, approved: JSON.stringify(approved), livePages: { donor: false, ambassador: true }, ...overrides };
}

test('managed public pages use the same approved snapshot on preview and production', async () => {
  for (const source of Object.values(sources)) {
    state.answer = fixture();
    const school = await source.getSchool('example-school');
    assert.equal(school.name, approved.name);
    assert.equal(school.logo, approved.logo);
    assert.equal(school.avatar, approved.avatar);
    assert.equal(school.photos.team, approved.photos.team);
    assert.equal(school.photos.cutoutSecondary, approved.photos.cutoutSecondary);
    assert.equal(school.photos.credits.team, approved.photoCredits.team);
    assert.equal(school.videoUrl, approved.videoUrl);
    assert.equal(school.videoHeading, approved.videoHeading);
    assert.equal(school.videoCaption, approved.videoCaption);
    assert.deepEqual(school.ambassadorTiers, approved.ambassadorTiers);
    assert.deepEqual(school.ambassadorPrograms, approved.ambassadorPrograms);
    assert.equal(school.logoHeightPx, 72);
    assert.deepEqual(school.livePages, { donor: false, ambassador: true });
  }
});

test('legacy schools retain staging behavior while production renders their approved edition', async () => {
  state.answer = fixture({ managementVersion: 1 });
  const preview = await sources.preview.getSchool('example-school');
  assert.equal(preview.name, 'Unapproved name');
  assert.deepEqual(preview.livePages, { donor: true, ambassador: true });
  const production = await sources.production.getSchool('example-school');
  assert.equal(production.name, approved.name);
  assert.deepEqual(production.livePages, { donor: false, ambassador: true });
});

test('malformed snapshots fail closed without falling back to unpublished school content', async () => {
  state.answer = fixture({ approved: 'not-json' });
  assert.equal(await sources.preview.getSchool('example-school'), undefined);
  assert.equal(await sources.production.getSchool('example-school'), undefined);
  state.answer = [fixture(), fixture({ approved: 'not-json' })];
  const schools = await sources.production.getSchools();
  assert.equal(schools.length, 1);
  assert.equal(schools[0].name, approved.name);
});

test('public lookups only select canonical documents and approved managed entries', async () => {
  for (const [mode, source] of Object.entries(sources)) {
    state.answer = null; state.calls = [];
    assert.equal(await source.getSchool('new-unpublished-school'), undefined);
    const query = state.calls[0].query;
    assert.match(query, /!\(_id in path\("drafts\.\*\*"\)\)/);
    assert.match(query, /!\(_id in path\("versions\.\*\*"\)\)/);
    assert.match(query, /productionStatus == "live"/);
    assert.match(query, /defined\(approvedVersion\)/);
    assert.deepEqual(state.calls[0].params, { slug: 'new-unpublished-school' });
    if (mode === 'preview') assert.match(query, /coalesce\(managementVersion, 1\) < 2/);
  }
});

test('an ID preview chooses its retained draft even before a canonical school exists', async () => {
  state.answer = { draft: { ...approved, name: 'Draft-only sales preview' }, live: null }; state.calls = [];
  const school = await sources.production.getSchoolDraftById('school.immutable-id');
  assert.equal(school.name, 'Draft-only sales preview');
  assert.deepEqual(school.livePages, { donor: true, ambassador: true });
  assert.deepEqual(state.calls[0].params, { id: 'school.immutable-id', draftId: 'drafts.school.immutable-id' });
  assert.deepEqual(state.calls[0].config, { perspective: 'raw', useCdn: false });
  assert.doesNotMatch(state.calls[0].query, /slug.current\s*==/);
  state.answer = { draft: { ...approved, name: 'Current draft' }, live: approved };
  assert.equal((await sources.preview.getSchoolDraftById('school.immutable-id')).name, 'Current draft');
  state.answer = { draft: null, live: approved };
  assert.equal((await sources.preview.getSchoolDraftById('school.immutable-id')).name, approved.name);
});
