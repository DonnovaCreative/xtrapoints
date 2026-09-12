#!/usr/bin/env node
/**
 * Stage structured editorial drafts; publishing is deliberately outside this tool.
 * node --env-file=.env scripts/import-toolkit-cms.mjs                  # read-only comparison
 * node scripts/import-toolkit-cms.mjs --offline                     # local dry-run
 * node --env-file=.env scripts/import-toolkit-cms.mjs --apply        # absent drafts only
 * node --env-file=.env scripts/import-toolkit-cms.mjs --export-drafts /private/tmp/new-candidate.json
 */
import { createClient } from "@sanity/client";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clone = (value) => JSON.parse(JSON.stringify(value));
const stable = (value) => value === undefined ? "undefined" : value === null || typeof value !== "object" ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(stable).join(",")}]` : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
export const toolkitHash = (value) => createHash("sha256").update(stable(value)).digest("hex");
const resourceId = (id) => `xp-toolkit.resource.${id}`;
const articleId = (resource, id) => `xp-toolkit.article.${resource}.${id}`;
const expectedIds = ["guide", "catalog", "builder", "communications", "kickoff", "rules"];
const instructions = "The retained Wiki masters remain authoritative until an explicit editorial cutover. Edit canonical article blocks here as proposals. Export the candidate, reconcile it with its retained master, regenerate every affected website and standard download edition, and verify the complete release. Publishing an article never updates public prose. Only a reviewed complete toolkit release matching the deployed website/download hashes can be served.";
const blockFields = ["type", "id", "text", "items", "headers", "rows", "title", "trigger", "subject", "body", "primary_action", "href", "url", "publisher", "evidence_type", "observation", "checked_on", "mediaStatus", "image", "src", "alt", "caption", "transcript", "captionsSrc", "placeholderInstructions"];
const articleFields = ["title", "lede", "category", "audience", "task", "outcome", "searchTerms"];
const normalizedType = (block) => block.type || ({ p: "paragraph", h: "heading", subheading: "heading", bullets: "list" }[block.kind] || block.kind);
const pick = (object, keys) => Object.fromEntries(keys.filter((key) => key in object).map((key) => [key, clone(object[key])]));

export function toCmsBlock(block, index) {
  return {
    ...pick(block, blockFields), type: normalizedType(block), _type: "xpToolkitContentBlock", _key: `b${index}`, sourceBlockJson: JSON.stringify(block),
    ...(block.type === "table" ? { rows: block.rows.map((cells, row) => ({ _type: "toolkitTableRow", _key: `r${row}`, cells: clone(cells) })) } : {}),
  };
}

export function fromCmsBlock(block) {
  const original = block.sourceBlockJson ? JSON.parse(block.sourceBlockJson) : undefined;
  const result = original ? clone(original) : {};
  for (const field of blockFields) {
    if (field in block) result[field] = clone(block[field]);
    else delete result[field];
  }
  if (!result.id && !original) result.id = `cms-${block._key}`;
  if (original && original.type === undefined && block.type === normalizedType(original)) delete result.type;
  if (result.type === "table") result.rows = (block.rows || []).map((row) => clone(row.cells || []));
  if (["image", "video"].includes(result.type) && result.mediaStatus === "placeholder") {
    result.mediaType = result.type; result.type = "media-placeholder"; result.brief = result.placeholderInstructions || result.caption;
  } else if (result.type === "video" && result.url && !result.src) result.src = result.url;
  return result;
}

function derivation(article) {
  if (article.sourceResource) return { editorialRole: "derived", derivedFrom: { _type: "reference", _weak: true, _ref: articleId(article.sourceResource, article.id) } };
  if (article.resource === "communications" && article.kind === "template" && article.section_id) return { editorialRole: "derived", derivedFrom: { _type: "reference", _weak: true, _ref: articleId("communications", article.section_id) } };
  if (article.kind === "rules-export") return { editorialRole: "derived", derivedFrom: { _type: "reference", _weak: true, _ref: articleId("rules", "r03") } };
  return { editorialRole: "canonical" };
}

export function prepareToolkitDocuments(publication) {
  if (publication.schemaVersion !== 1 || publication.resources.length !== 6 ||
      expectedIds.some((id) => publication.resources.filter((resource) => resource.id === id).length !== 1)) throw new Error("Expected the complete six-resource publication contract");
  const resources = publication.resources.map((resource) => ({
    _id: `drafts.${resourceId(resource.id)}`, _type: "xpToolkitResource",
    ...pick(resource, ["id", "title", "description", "action", "sourceVersion"]), releaseVersion: publication.release.version,
    sourceHash: toolkitHash(resource), sourceResourceJson: JSON.stringify(resource), editorInstructions: instructions,
  }));
  const articles = publication.articles.map((article) => ({
    _id: `drafts.${articleId(article.resource, article.id)}`, _type: "xpToolkitArticle",
    ...pick(article, ["id", "resource", "kind", ...articleFields]), ...derivation(article), releaseVersion: publication.release.version,
    resourceRef: { _type: "reference", _weak: true, _ref: resourceId(article.resource) },
    blocks: article.blocks.map(toCmsBlock),
    ...(article.context ? { context: article.context.map(toCmsBlock) } : {}),
    sourceHash: toolkitHash(article), sourceArticleJson: JSON.stringify(article), editorInstructions: instructions,
  }));
  const formats = publication.resources.map((resource) => ({
    _type: "toolkitReleaseFormat", _key: resource.id, resourceId: resource.id,
    filename: resource.download.filename, format: resource.format,
    ...publication.downloadHashes[resource.id], source: "bundled",
  }));
  if (formats.some((format) => !/^[a-f0-9]{64}$/.test(format.sha256) || !Number.isInteger(format.bytes) || format.bytes <= 0)) throw new Error("A download is missing its verified hash or size");
  const release = {
    _id: `drafts.xp-toolkit.release.${publication.release.revision}`, _type: "xpToolkitRelease",
    title: `Ambassador Toolkit ${publication.release.version} · ${publication.release.revision}`,
    version: publication.release.version, revision: publication.release.revision, releaseDate: publication.release.date,
    status: "prepared", publicationSnapshot: JSON.stringify(publication), snapshotSha256: toolkitHash(publication),
    formats, sourceHashes: Object.entries(publication.sourceHashes).map(([sourcePath, sha256], index) => ({ _type: "toolkitSourceHash", _key: `s${index}`, path: sourcePath, sha256 })),
    editorInstructions: `${instructions} This release's snapshot and manifest are generated, not hand-edited. Once published and approved, retain the release unchanged and create a new revision for changes.`,
  };
  const documents = [...resources, ...articles, release];
  if (new Set(documents.map((doc) => doc._id)).size !== documents.length) throw new Error("Duplicate canonical resource/article IDs");
  return documents;
}

const withoutSystem = (document) => {
  const { _rev, _createdAt, _updatedAt, ...rest } = document;
  return rest;
};

export function compareToolkitDocuments(proposed, existing) {
  return proposed.map((document) => {
    const draft = existing.find((item) => item._id === document._id);
    const published = existing.find((item) => item._id === document._id.slice(7));
    return {
      id: document._id, type: document._type, sourceHash: document.sourceHash || document.snapshotSha256,
      proposedHash: toolkitHash(document),
      ...(draft ? { existingHash: toolkitHash(withoutSystem(draft)) } : {}),
      status: draft ? toolkitHash(withoutSystem(draft)) === toolkitHash(document) ? "unchanged" : "existing_draft_preserved"
        : published ? "published_record_preserved" : "new_draft",
    };
  });
}

/** Rebuild derived pages so a message or guide passage has one edit location. */
export function exportToolkitCandidate(publication, documents) {
  const candidate = clone(publication);
  const current = (id) => documents.find((doc) => doc._id === `drafts.${id}`) || documents.find((doc) => doc._id === id);
  for (let index = 0; index < candidate.resources.length; index++) {
    const resource = candidate.resources[index];
    const doc = current(resourceId(resource.id));
    if (!doc) throw new Error(`Missing resource document: ${resource.id}`);
    for (const field of ["title", "description", "action"]) {
      if (field in doc) resource[field] = clone(doc[field]); else delete resource[field];
    }
  }
  for (const article of candidate.articles) {
    if (derivation(article).editorialRole === "derived") continue;
    const doc = current(articleId(article.resource, article.id));
    if (!doc) throw new Error(`Missing article document: ${article.resource}/${article.id}`);
    for (const field of articleFields) {
      if (field in doc) article[field] = clone(doc[field]); else delete article[field];
    }
    article.blocks = (doc.blocks || []).map(fromCmsBlock);
    if (doc.context) article.context = doc.context.map(fromCmsBlock);
  }
  for (const article of candidate.articles) {
    if (article.sourceResource) {
      const source = candidate.articles.find((item) => item.resource === article.sourceResource && item.id === article.id);
      for (const field of ["title", "lede", "blocks"]) if (field in source) article[field] = clone(source[field]);
    } else if (article.resource === "communications" && article.kind === "template" && article.section_id) {
      const source = candidate.articles.find((item) => item.resource === "communications" && item.id === article.section_id);
      const message = source.blocks.find((block) => block.type === "message" && block.id === article.id);
      if (!message) throw new Error(`Canonical message removed: ${article.id}; reconcile source IDs before export`);
      article.title = message.title; article.lede = message.trigger; article.blocks = [clone(message)];
      article.context = clone(source.blocks.filter((block) => block.type !== "message")).map((block, index) => ({
        ...block, ...(/^block-\d+$/.test(block.id) ? { id: `block-${index}` } : {}),
      }));
    } else if (article.kind === "rules-export") {
      article.blocks = candidate.articles.filter((item) => item.resource === "rules" && /^r0[3-8]$/.test(item.id)).flatMap((item) => clone(item.blocks)).map((block, index) => ({
        ...block, ...(/^block-\d+$/.test(block.id) ? { id: `block-${index}` } : {}),
      }));
    }
  }
  const textOf = (value) => typeof value === "string" ? value : Array.isArray(value) ? value.map(textOf).join(" ") : value && typeof value === "object" ? Object.entries(value).filter(([key]) => !["id", "type", "kind", "href", "source_ids"].includes(key)).map(([, child]) => textOf(child)).join(" ") : "";
  for (const article of candidate.articles) {
    article.text = textOf([article.title, article.lede || "", article.blocks]);
    article.readingMinutes = Math.max(1, Math.ceil(textOf(article.blocks).split(/\s+/).length / 200));
  }
  // A candidate has not been reconciled against the masters or regenerated
  // downloads. It cannot masquerade as a verified generated publication.
  candidate.generated = false;
  candidate.editorialCandidate = {
    status: "requires-source-reconciliation-and-download-regeneration",
    basedOnRevision: publication.release.revision,
    basedOnSnapshotSha256: toolkitHash(publication),
  };
  return candidate;
}

async function verifyLocalDownloads(publication) {
  for (const resource of publication.resources) {
    const file = JSON.parse(await readFile(path.join(root, "src/data/toolkit/downloads", `${resource.id}.json`), "utf8"));
    const bytes = Buffer.from(file.base64, "base64");
    const expected = publication.downloadHashes[resource.id];
    if (file.filename !== resource.download.filename || bytes.length !== expected.bytes || createHash("sha256").update(bytes).digest("hex") !== expected.sha256) throw new Error(`Local download mismatch: ${resource.id}`);
  }
}

async function main() {
  process.umask(0o077);
  const args = process.argv.slice(2);
  const value = (key) => args.includes(key) ? args[args.indexOf(key) + 1] : undefined;
  if (args.includes("--help")) {
    console.log("Dry-run by default. --offline verifies local sources/downloads only. --apply creates absent draft documents only. --export-drafts PATH writes a new candidate JSON requiring source reconciliation and complete regeneration. No command publishes a document or uploads an asset.");
    return;
  }
  const allowed = new Set(["--offline", "--apply", "--export-drafts", "--report"]);
  for (let index = 0; index < args.length; index++) {
    if (!allowed.has(args[index])) throw new Error("Unknown argument; use --help");
    if (["--export-drafts", "--report"].includes(args[index])) {
      if (!args[index + 1] || args[index + 1].startsWith("--")) throw new Error("Missing output path");
      index++;
    }
  }
  const offline = args.includes("--offline"), apply = args.includes("--apply"), exportPath = value("--export-drafts");
  if ((offline && (apply || exportPath)) || (apply && exportPath)) throw new Error("Choose one of offline planning, draft import, or draft export");
  const publication = JSON.parse(await readFile(path.join(root, "src/data/toolkit/content.json"), "utf8"));
  await verifyLocalDownloads(publication);
  const proposed = prepareToolkitDocuments(publication);
  let source;
  let existing = [];
  if (!offline) {
    const token = process.env[apply ? "SANITY_WRITE_TOKEN" : "SANITY_READ_TOKEN"];
    if (!token) throw new Error(`${apply ? "SANITY_WRITE_TOKEN" : "SANITY_READ_TOKEN"} is required; use --offline for local planning`);
    source = createClient({ projectId: process.env.SANITY_PROJECT_ID || "xjhhxbqk", dataset: process.env.SANITY_DATASET || "production", apiVersion: "2025-02-19", token, perspective: "raw", useCdn: false });
    existing = await source.fetch('*[_type in ["xpToolkitResource", "xpToolkitArticle", "xpToolkitRelease"]]');
  }
  const comparison = compareToolkitDocuments(proposed, existing);
  const summary = { mode: offline ? "offline-dry-run" : exportPath ? "export-candidate" : apply ? "create-missing-drafts" : "dry-run", version: publication.release.version,
    resources: proposed.filter((doc) => doc._type === "xpToolkitResource").length,
    articles: proposed.filter((doc) => doc._type === "xpToolkitArticle").length,
    releaseDrafts: 1, formatsVerified: 6,
    counts: comparison.reduce((counts, entry) => ({ ...counts, [entry.status]: (counts[entry.status] || 0) + 1 }), {}),
  };
  if (value("--report")) await writeFile(value("--report"), `${JSON.stringify({ ...summary, comparison }, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  if (exportPath) {
    // Resolve existing uploads for the candidate without copying/uploading any
    // asset. The generated publication renderer consumes src, not Sanity refs.
    const blocks = existing.flatMap((doc) => [...(doc.blocks || []), ...(doc.context || [])]);
    const refs = [...new Set(blocks.map((block) => block.image?.asset?._ref).filter(Boolean))];
    if (refs.length) {
      const assets = await source.fetch('*[_id in $ids]{_id,url}', { ids: refs });
      for (const block of blocks) {
        if (!block.image?.asset?._ref) continue;
        const asset = assets.find((item) => item._id === block.image.asset._ref);
        if (!asset?.url) throw new Error("An editorial image reference is missing its asset; export stopped");
        block.src = asset.url;
      }
    }
    const candidate = exportToolkitCandidate(publication, existing);
    await writeFile(exportPath, `${JSON.stringify(candidate, null, 2)}\n`, { mode: 0o600, flag: "wx" });
  } else if (apply) {
    const missing = proposed.filter((doc) => comparison.find((item) => item.id === doc._id).status === "new_draft");
    if (missing.length) {
      let transaction = source.transaction();
      for (const document of missing) transaction = transaction.createIfNotExists(document);
      await transaction.commit({ visibility: "sync", returnDocuments: false });
      // Re-running is safe: createIfNotExists never overwrites an edited draft.
    }
    summary.createdDraftsRequested = missing.length;
    summary.publishedDocumentsChanged = 0;
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    // SDK exceptions may contain request headers. Print no exception objects.
    console.error(error?.statusCode ? `Sanity request failed (HTTP ${error.statusCode})` : String(error?.message || "Operation failed").replace(/https?:\/\/\S+/g, "[URL]"));
    process.exitCode = 1;
  });
}
