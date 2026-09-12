import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { blocksToText, filledText, placeholders } from '../src/components/resources/templateText.ts';

const dataPath = new URL('../src/data/toolkit/', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, dataPath), 'utf8'));
const data = read('content.json');

test('the release has exactly six resources, original source IDs, and no orphan article links', () => {
  assert.equal(data.release.version, '1.2');
  assert.deepEqual(data.resources.map((item: any) => item.id), ['guide', 'catalog', 'builder', 'communications', 'kickoff', 'rules']);
  const hrefs = data.articles.map((item: any) => item.href);
  assert.equal(new Set(hrefs).size, hrefs.length);
  for (const article of data.articles) assert.ok(data.resources.some((resource: any) => resource.id === article.resource));
  for (const section of read('masters/guide/guide.json').sections) {
    const article = data.articles.find((item: any) => item.resource === 'guide' && item.id === section.id);
    assert.ok(article, `Missing guide source section ${section.id}`);
    assert.equal(article.blocks.length, section.blocks.length);
    for (let i = 0; i < section.blocks.length; i++) for (const [key, value] of Object.entries(section.blocks[i])) if (!['type', 'kind'].includes(key)) assert.deepEqual(article.blocks[i][key], value);
  }
});

test('every canonical message keeps its complete body and source page mapping', () => {
  const source = read('masters/operating/communications.json');
  const messages = source.pages.flatMap((page: any) => page.blocks.filter((block: any) => block.kind === 'message').map((block: any) => ({ ...block, section_id: page.id })));
  assert.equal(messages.length, 23);
  for (const message of messages) {
    const article = data.articles.find((item: any) => item.resource === 'communications' && item.id === message.id);
    assert.ok(article, `Missing message ${message.id}`);
    assert.equal(article.section_id, message.section_id);
    assert.deepEqual(article.blocks[0].body, message.body);
    assert.equal(article.blocks[0].subject, message.subject);
    assert.equal(article.blocks[0].trigger, message.trigger);
  }
});

test('participant export contains the six participant sections and excludes internal records', () => {
  const rules = read('masters/operating/rules.json');
  const expected = rules.pages.filter((page: any) => /^r0[3-8]$/.test(page.id)).flatMap((page: any) => page.blocks);
  const actual = data.articles.find((item: any) => item.id === 'participant-rules').blocks;
  assert.equal(actual.length, expected.length);
  expected.forEach((block: any, index: number) => { for (const [key, value] of Object.entries(block)) if (!['type', 'kind', 'id'].includes(key)) assert.deepEqual(actual[index][key], value); });
  assert.match(JSON.stringify(actual), /three completed monthly donations in three consecutive months/i);
  assert.doesNotMatch(JSON.stringify(actual), /Enrollment and consent record|Referral and achievement review record/);
});

test('all 60 incentive ideas and all kickoff notes remain discoverable', () => {
  const ideas = read('masters/catalog/catalog.json').ideas;
  assert.equal(data.articles.filter((item: any) => item.resource === 'catalog').length, 60);
  for (const idea of ideas) {
    const article = data.articles.find((item: any) => item.resource === 'catalog' && item.id === idea.id);
    assert.equal(article.title, idea.idea); assert.equal(article.cost.low, idea.cash_low); assert.equal(article.cost.high, idea.cash_high);
  }
  for (const slide of read('masters/operating/kickoff.json').slides) {
    const article = data.articles.find((item: any) => item.resource === 'kickoff' && item.id === slide.id);
    for (const paragraph of slide.notes.split('\n\n')) assert.ok(article.blocks.some((block: any) => block.text === paragraph));
  }
});

test('standard downloads are byte-for-byte members of the same published release', () => {
  const manifest = read('masters/release-manifest.json');
  for (const resource of data.resources) {
    const packaged = read(`downloads/${resource.id}.json`);
    const bytes = Buffer.from(packaged.base64, 'base64');
    const recorded = manifest.files.find((file: any) => file.path === `downloads/${packaged.filename}`);
    assert.equal(bytes.length, recorded.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), recorded.sha256);
    assert.ok(resource.download.href.startsWith('/resources/ambassador-toolkit/downloads/'));
    assert.ok(!resource.download.href.startsWith('/toolkit/'), 'Private downloads must not be public static files');
  }
});

test('generated content and Sanity migration contract reproduce from retained masters', () => {
  execFileSync(process.execPath, ['scripts/build-toolkit-content.mjs', '--check'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
});

test('message copies contain only subject and body, and personalization preserves unresolved choices', () => {
  const message = data.articles.find((item: any) => item.id === 'M01');
  const output = blocksToText(message.blocks, { 'Organization name': 'Example University', 'First name': 'Sam' });
  assert.match(output, /^Subject: Help share the story of Example University/);
  assert.match(output, /Hi Sam,/);
  assert.doesNotMatch(output, /Use after your organization|primary_action|Recruitment invitation/);
  assert.ok(output.includes('[Program name]'));
  assert.ok(!placeholders(message.blocks).includes('trigger'));
  assert.equal(filledText('[Organization name]', { 'Organization name': '<script>alert(1)</script>' }), '<script>alert(1)</script>');
  // Values are passed as React text nodes, not interpreted as HTML.
  assert.doesNotMatch(readFileSync(new URL('../src/components/resources/BlockContent.tsx', import.meta.url), 'utf8'), /dangerouslySetInnerHTML/);
});

test('every guided launch checklist link resolves to a retained article or a standard download', () => {
  for (const stage of data.stages) for (const link of stage.links) {
    if (link.kind === 'download') assert.ok(data.resources.some((resource: any) => resource.id === link.id));
    else assert.ok(data.articles.some((article: any) => article.resource === (link.kind === 'message' ? 'communications' : link.kind) && article.id === link.id), `${stage.id}: missing ${link.id}`);
  }
});
