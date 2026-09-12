#!/usr/bin/env node
/** Generated native publication adapter. The retained JSON masters remain canonical.
 * First import: node scripts/build-toolkit-content.mjs --source-dir /path/_source --library-dir /path/library
 * Rebuild/check: node scripts/build-toolkit-content.mjs [--check]
 * No remote CMS writes or publication occur here.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dest = resolve(root, 'src/data/toolkit');
const args = process.argv.slice(2);
const option = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
const hash = value => createHash('sha256').update(value).digest('hex');
const files = ['guide/guide.json', 'catalog/catalog.json', 'operating/communications.json', 'operating/rules.json', 'operating/kickoff.json', 'experience/content-map.json', 'experience/rules-guidance.json'];
const sourceDir = option('--source-dir'), libraryDir = option('--library-dir');
if (Boolean(sourceDir) !== Boolean(libraryDir)) throw new Error('Import requires both --source-dir and --library-dir.');
if (sourceDir) {
  for (const path of files) {
    mkdirSync(resolve(dest, 'masters', dirname(path)), { recursive: true });
    copyFileSync(resolve(sourceDir, path), resolve(dest, 'masters', path));
  }
  copyFileSync(resolve(libraryDir, 'manifest.json'), resolve(dest, 'masters/release-manifest.json'));
}
const read = name => JSON.parse(readFileSync(resolve(dest, 'masters', name), 'utf8'));
const guide = read('guide/guide.json'), catalog = read('catalog/catalog.json');
const communications = read('operating/communications.json'), rules = read('operating/rules.json');
const kickoff = read('operating/kickoff.json'), experience = read('experience/content-map.json'), rulesGuidance = read('experience/rules-guidance.json');
const manifest = read('release-manifest.json');
if (manifest.version !== guide.version || manifest.version !== communications.version || manifest.version !== kickoff.version) throw new Error('Mixed toolkit release: review sources and regenerate all affected editions together.');
const base = '/resources/ambassador-toolkit';
const kindMap = { p: 'paragraph', h: 'heading', subheading: 'heading', bullets: 'list' };
const normalize = (blocks = []) => blocks.map((b, i) => ({ ...b, id: b.id || `block-${i}`, type: kindMap[b.type || b.kind] || b.type || b.kind }));
const textOf = value => typeof value === 'string' ? value : Array.isArray(value) ? value.map(textOf).join(' ') : value && typeof value === 'object' ? Object.entries(value).filter(([key]) => !['id', 'type', 'kind', 'href', 'source_ids'].includes(key)).map(([, v]) => textOf(v)).join(' ') : '';
const resources = [
  { id: 'guide', title: 'Launch & Operations Guide', description: 'Build a launch plan with clear decisions, owners, dates and a support path.', action: 'Plan your launch', source: 'guide/guide.json', sourceVersion: guide.version, format: 'PDF' },
  { id: 'catalog', title: 'Incentive Ideas Catalog', description: 'Find rewards your organization can fund, approve and deliver.', action: 'Explore incentive ideas', source: 'catalog/catalog.json', sourceVersion: catalog.version, format: 'XLSX' },
  { id: 'builder', title: 'Program Builder', description: 'Turn your choices into a program plan, budget, tiers and reward record.', action: 'Build your program', source: 'guide/guide.json', sourceVersion: guide.version, format: 'XLSX' },
  { id: 'communications', title: 'Communications & Welcome Kit', description: 'Adapt invitations, reminders, welcome materials and outreach for your program.', action: 'Prepare your messages', source: 'operating/communications.json', sourceVersion: communications.version, format: 'DOCX' },
  { id: 'kickoff', title: 'Ambassador Kickoff', description: 'Prepare a partner-led session with a clear agenda and facilitator notes.', action: 'Prepare your kickoff', source: 'operating/kickoff.json', sourceVersion: kickoff.version, format: 'PPTX' },
  { id: 'rules', title: 'Rules & Administration Templates', description: 'Agree on participant terms and keep a consistent record of your decisions.', action: 'Prepare your rules', source: 'operating/rules.json', sourceVersion: rules.version, format: 'DOCX' },
].map(resource => ({ ...resource, href: `${base}/${resource.id}`, download: { filename: experience.downloads[resource.id].filename, href: `${base}/downloads/${resource.id}`, format: resource.format } }));
const articles = [];
function add(resource, data) {
  const blocks = normalize(data.blocks);
  articles.push({ resource, ...data, blocks, href: `${base}/${resource}/${encodeURIComponent(data.id)}`, text: textOf([data.title, data.lede || '', blocks]), readingMinutes: Math.max(1, Math.ceil(textOf(blocks).split(/\s+/).length / 200)) });
}
guide.sections.forEach(section => add('guide', { ...section, kind: 'article', category: 'Launch guidance' }));
for (const id of ['builder', 'economics', 'model-scope']) {
  const section = guide.sections.find(item => item.id === id);
  add('builder', { ...section, kind: 'article', category: 'Workbook guidance', sourceResource: 'guide' });
}
for (const page of communications.pages) {
  const meta = experience.communication_sections.find(item => item.id === page.id) || {};
  add('communications', { ...page, kind: 'article', category: 'Reference', audience: meta.audience });
  for (const block of page.blocks.filter(item => item.kind === 'message')) {
    const message = experience.messages.find(item => item.id === block.id) || {};
    add('communications', { ...message, id: block.id, title: block.title, lede: block.trigger, kind: 'template', blocks: [block], context: normalize(page.blocks.filter(item => item.kind !== 'message')) });
  }
}
rules.pages.forEach(page => add('rules', { ...page, kind: ['r01', 'r12'].includes(page.id) ? 'article' : 'template', category: ['r03', 'r04', 'r05', 'r06', 'r07', 'r08'].includes(page.id) ? 'Participant terms' : 'Administrator guidance' }));
for (const [key, page] of Object.entries(rulesGuidance)) add('rules', { ...page, id: key === 'start' ? 'start-here' : page.id, kind: 'article', category: 'Start here' });
add('rules', { id: 'participant-rules', title: 'Complete participant rules', kind: 'rules-export', category: 'Participant terms', lede: 'Prepare one participant copy from the six specimen sections. Your organization completes, reviews and adopts the wording.', blocks: rules.pages.filter(page => /^r0[3-8]$/.test(page.id)).flatMap(page => page.blocks) });
for (const slide of kickoff.slides) {
  const blocks = [];
  for (const key of ['subtitle', 'statement', 'quote', 'main']) if (slide[key]) blocks.push({ type: 'paragraph', text: slide[key] });
  if (slide.lines) blocks.push({ type: 'list', items: slide.lines });
  if (slide.steps) blocks.push({ type: 'list', items: slide.steps });
  for (const side of ['left', 'right']) if (slide[side]) blocks.push({ type: 'heading', text: slide[`${side}Title`] }, { type: 'list', items: slide[side] });
  if (slide.headers) blocks.push({ type: 'table', headers: slide.headers, rows: slide.rows });
  if (slide.contacts) blocks.push({ type: 'list', items: slide.contacts });
  if (slide.callout) blocks.push({ type: 'callout', text: slide.callout });
  blocks.push({ type: 'heading', text: 'Facilitator notes' }, ...slide.notes.split('\n\n').map(text => ({ type: 'paragraph', text })));
  add('kickoff', { id: slide.id, title: slide.id === 's01' ? 'Welcome and session setup' : slide.title, kind: 'article', category: 'Facilitator guide', minutes: slide.minutes, blocks });
}
for (const idea of catalog.ideas) {
  const labels = { cost_basis: 'Cost basis', participant_value: 'Participant value', provider: 'Provider', funder: 'Funder', admin_owner: 'Administration owner', permissions: 'Permissions', capacity: 'Capacity', lead_time: 'Lead time', staff_effort: 'Staff effort' };
  const sources = idea.source_ids.map(id => catalog.sources.find(source => source.id === id)).filter(Boolean);
  add('catalog', { id: idea.id, title: idea.idea, category: idea.category, kind: 'idea', contexts: idea.contexts, cost: { low: idea.cash_low, high: idea.cash_high, unit: idea.cost_unit }, lede: `${idea.contexts.join(', ')}`, blocks: [{ type: 'callout', text: catalog.cost_definition }, { type: 'table', headers: ['Planning detail', 'What to consider'], rows: [['Cash planning range', `$${idea.cash_low}–$${idea.cash_high} USD ${idea.cost_unit}`], ...Object.entries(labels).map(([key, label]) => [label, idea[key]])] }, { type: 'paragraph', text: `Price and source information checked ${idea.checked_on}. Confirm current availability and cost with the provider.` }, ...sources.map(source => ({ type: 'source', ...source })), { type: 'link', text: `Related idea: ${catalog.ideas.find(item => item.id === idea.alternative_id)?.idea || idea.alternative_id}`, href: `${base}/catalog/${idea.alternative_id}` }] });
}
const sourceHashes = Object.fromEntries(files.map(file => [file, hash(readFileSync(resolve(dest, 'masters', file)))]));
const downloadHashes = {};
for (const resource of resources) {
  const item = manifest.files.find(file => file.path === `downloads/${resource.download.filename}`);
  if (!item) throw new Error(`Release manifest missing ${resource.id}`);
  const target = resolve(dest, 'downloads', `${resource.id}.json`);
  const bytes = libraryDir ? readFileSync(resolve(libraryDir, item.path)) : Buffer.from(JSON.parse(readFileSync(target, 'utf8')).base64, 'base64');
  if (bytes.length !== item.bytes || hash(bytes) !== item.sha256) throw new Error(`Download integrity mismatch: ${item.path}`);
  if (libraryDir) writeFileSync(target, JSON.stringify({ filename: resource.download.filename, base64: bytes.toString('base64') }));
  downloadHashes[resource.id] = { sha256: item.sha256, bytes: item.bytes };
}
// Instructional diagram text comes from the private release, not tracked UI.
const joiningSlide = kickoff.slides.find(slide => slide.id === 's07');
const journeySection = guide.sections.find(section => section.id === 'journey');
const ruleIntroduction = rules.pages.find(page => page.id === 'r01').blocks[1].text;
const visuals = {
  qualification: { title: 'When a supporter qualifies', subtitle: ruleIntroduction.split(/(?<=[.!?])\s+/).at(-1), note: catalog.milestone_example.qualification, steps: ['Month one', 'Month two', 'Month three'].map(title => ({ title, text: 'Completed monthly donation' })) },
  joining: { title: joiningSlide.title, subtitle: 'Use your verified program and platform flow.', steps: joiningSlide.steps.map(([title, text]) => ({ title, text })), note: journeySection.blocks.at(-1).text },
};
const data = { schemaVersion: 1, generated: true, release: { version: manifest.version, date: manifest.released, revision: manifest.revision }, sourceHashes, downloadHashes, resources, articles, visuals, stages: experience.stages, sharedFields: experience.shared_fields, contextualFields: experience.contextual_fields, sources: guide.sources, catalogSources: catalog.sources, catalogMilestoneExample: catalog.milestone_example };
const ids = new Set();
for (const article of articles) {
  if (ids.has(`${article.resource}/${article.id}`)) throw new Error(`Duplicate article ${article.id}`);
  ids.add(`${article.resource}/${article.id}`);
}
const outputs = { 'content.json': JSON.stringify(data, null, 2) + '\n', 'sanity-export.ndjson': [...resources.map(resource => ({ _id: `xp-toolkit.resource.${resource.id}`, _type: 'xpToolkitResource', releaseVersion: manifest.version, ...resource })), ...articles.map(article => ({ _id: `xp-toolkit.article.${article.resource}.${article.id}`, _type: 'xpToolkitArticle', releaseVersion: manifest.version, resourceRef: { _type: 'reference', _ref: `xp-toolkit.resource.${article.resource}` }, ...article }))].map(value => JSON.stringify(value)).join('\n') + '\n' };
for (const [name, output] of Object.entries(outputs)) {
  const path = resolve(dest, name);
  if (args.includes('--check')) { if (readFileSync(path, 'utf8') !== output) throw new Error(`Stale generated ${name}. Run the content builder.`); }
  else writeFileSync(path, output);
}
console.log(`${args.includes('--check') ? 'Verified' : 'Generated'} toolkit ${manifest.version}: ${resources.length} resources, ${articles.length} articles, six verified downloads.`);
