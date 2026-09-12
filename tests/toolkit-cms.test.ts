import assert from "node:assert/strict";
import { test } from "node:test";
import publication from "../src/data/toolkit/content.json" with { type: "json" };
import {
  compareToolkitDocuments, exportToolkitCandidate, fromCmsBlock,
  prepareToolkitDocuments, toCmsBlock,
} from "../scripts/import-toolkit-cms.mjs";
import { selectToolkitPublication, validateToolkitRelease, type ToolkitReleaseDocument } from "../src/data/toolkitCms.ts";

function approvedRelease(): ToolkitReleaseDocument {
  const prepared = prepareToolkitDocuments(publication).find((doc: { _type: string }) => doc._type === "xpToolkitRelease");
  return { ...prepared, _id: prepared._id.replace(/^drafts\./, ""), status: "approved", approvedBy: "Staff reviewer", approvedAt: "2026-09-12T01:00:00Z" };
}

test("structured CMS staging contains exactly six resources, 145 articles and one unapproved release draft", () => {
  const docs = prepareToolkitDocuments(publication);
  assert.equal(docs.length, 152);
  assert(docs.every((doc: { _id: string }) => doc._id.startsWith("drafts.")));
  assert.equal(docs.filter((doc: { _type: string }) => doc._type === "xpToolkitResource").length, 6);
  assert.equal(docs.at(-1).status, "prepared");
  assert.equal(docs.at(-1).formats.length, 6);
});

test("every imported content/context block round-trips with all source fields intact", () => {
  for (const article of publication.articles) {
    const blocks = [...article.blocks, ...("context" in article ? article.context ?? [] : [])];
    blocks.forEach((block, index) => assert.deepEqual(fromCmsBlock(toCmsBlock(block, index)), block));
  }
});

test("dry-run detects existing edits and published records without replacing either", () => {
  const [first, second] = prepareToolkitDocuments(publication);
  const existing = [{ ...first, title: "Editorial change", _rev: "abc" }, { ...second, _id: second._id.slice(7) }];
  const before = JSON.stringify(existing);
  const report = compareToolkitDocuments([first, second], existing);
  assert.deepEqual(report.map((entry: { status: string }) => entry.status), ["existing_draft_preserved", "published_record_preserved"]);
  assert.equal(JSON.stringify(existing), before);
  assert.equal(compareToolkitDocuments([first], [{ ...first, _rev: "rev" }])[0].status, "unchanged");
});

test("only a published approved snapshot with matching website and six downloads is accepted", () => {
  const release = approvedRelease();
  assert.deepEqual(validateToolkitRelease(release), publication);
  assert.equal(selectToolkitPublication([release]).origin, "cms");
  for (const changed of [
    { ...release, _id: `drafts.${release._id}` },
    { ...release, status: "prepared" },
    { ...release, approvedBy: "" },
    { ...release, revision: "other-edition" },
    { ...release, snapshotSha256: "bad" },
    { ...release, publicationSnapshot: "invalid JSON" },
    { ...release, formats: release.formats.slice(1) },
    { ...release, formats: release.formats.map((format, index) => index ? format : { ...format, sha256: "different-binary" }) },
    { ...release, sourceHashes: [] },
  ]) {
    assert.equal(validateToolkitRelease(changed), undefined);
    assert.equal(selectToolkitPublication([changed]).origin, "bundled");
  }
});

test("mutable article changes cannot affect an approved release snapshot", () => {
  const docs = prepareToolkitDocuments(publication);
  const release = approvedRelease();
  docs.find((doc: { _type: string; editorialRole: string }) => doc._type === "xpToolkitArticle" && doc.editorialRole === "canonical").blocks[0].text = "Changed editorial draft";
  const selected = selectToolkitPublication([release]);
  assert.deepEqual(selected.toolkit, publication);
});

test("export is clearly a candidate and regenerates message detail from its canonical section", () => {
  const docs = prepareToolkitDocuments(publication);
  const canonical = docs.find((doc: { _id: string }) => doc._id === "drafts.xp-toolkit.article.communications.c03");
  canonical.blocks.find((block: { id: string }) => block.id === "M01").body[0] = "Updated greeting";
  const candidate = exportToolkitCandidate(publication, docs);
  assert.equal(candidate.generated, false);
  assert.equal(candidate.editorialCandidate.status, "requires-source-reconciliation-and-download-regeneration");
  assert.equal(candidate.articles.find((article: { id: string; resource: string }) => article.resource === "communications" && article.id === "M01").blocks[0].body[0], "Updated greeting");
  assert.deepEqual(candidate.downloadHashes, publication.downloadHashes, "Existing hashes are provenance, not proof that a candidate was regenerated");
});

test("candidate export preserves every article ID and resource count", () => {
  const candidate = exportToolkitCandidate(publication, prepareToolkitDocuments(publication));
  assert.deepEqual(candidate.articles.map((article: { id: string; resource: string }) => `${article.resource}/${article.id}`), publication.articles.map((article) => `${article.resource}/${article.id}`));
  assert.equal(candidate.resources.length, 6);
  assert.equal(candidate.release.version, "1.2");
  assert.deepEqual(candidate.articles, publication.articles, "An unedited editorial round-trip must not change any original article");
});

test("new media requests export as clearly labeled placeholders", () => {
  const block = fromCmsBlock({ _key: "requested-screen", type: "image", title: "Partner brand editor", mediaStatus: "placeholder", placeholderInstructions: "Verified screenshot of choosing a school logo" });
  assert.equal(block.type, "media-placeholder");
  assert.equal(block.mediaType, "image");
  assert.equal(block.brief, "Verified screenshot of choosing a school logo");
  assert.equal(block.src, undefined);
});
