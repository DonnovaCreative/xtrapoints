// One-shot migration: resourceTemplate went from a single asset per document
// (assetType + file/externalUrl/templateId) to a `formats[]` array, plus a slug.
// This folds each old document's single asset into a one-item formats array so
// nothing already entered in the Studio has to be retyped.
//
// Safe to re-run: documents that already have formats[] are skipped.
// Delete this file once it's been run everywhere it needs to be.
// sanity/cli is CommonJS; under Node's type-stripping ESM loader a named import
// fails, so load getCliClient through createRequire (same as scripts/_lib.ts).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getCliClient } = require("sanity/cli");

const client = getCliClient({ apiVersion: "2024-01-01" });

// Best guess at which tool an old single-asset resource belonged to, from its
// file extension or link host. Anything unrecognized becomes "other", which an
// editor can correct in one click.
const platformFor = (doc: {
  assetType?: string;
  externalUrl?: string;
  filename?: string;
}): string => {
  if (doc.assetType === "generated") return "pdf";
  const url = doc.externalUrl ?? "";
  if (/canva\.com/i.test(url)) return "canva";
  if (/figma\.com/i.test(url)) return "figma";
  if (/docs\.google\.com\/presentation/i.test(url)) return "googleSlides";
  if (/docs\.google\.com\/document/i.test(url)) return "googleDocs";
  if (url) return "other";

  const ext = (doc.filename ?? "").split(".").pop()?.toLowerCase();
  const byExt: Record<string, string> = {
    fig: "figma", // a downloadable Figma file, not a share link
    psd: "photoshop",
    ai: "illustrator",
    indd: "indesign",
    pptx: "powerpoint",
    ppt: "powerpoint",
    key: "keynote",
    pdf: "pdf",
    png: "image",
    jpg: "image",
    jpeg: "image",
    svg: "image",
    mp4: "video",
    mov: "video",
  };
  return (ext && byExt[ext]) ?? "other";
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 96);

async function run() {
  const docs = await client.fetch<
    {
      _id: string;
      title: string;
      assetType?: string;
      externalUrl?: string;
      templateId?: string;
      instructions?: string;
      slug?: { current?: string };
      formats?: unknown[];
      fileRef?: string;
      filename?: string;
    }[]
  >(`*[_type == "resourceTemplate"]{
    _id, title, assetType, externalUrl, templateId, instructions, slug, formats,
    "fileRef": file.asset._ref,
    "filename": file.asset->originalFilename
  }`);

  const pending = docs.filter((d) => !d.formats?.length);
  if (pending.length === 0) {
    console.log(`Nothing to migrate (${docs.length} resource(s) already on the new shape).`);
    return;
  }

  const tx = client.transaction();
  for (const doc of pending) {
    const source = doc.assetType ?? "staticFile";
    const format: Record<string, unknown> = {
      _type: "format",
      _key: `migrated-${Math.random().toString(36).slice(2, 10)}`,
      platform: platformFor(doc),
      source,
      ...(doc.instructions ? { note: doc.instructions } : {}),
    };
    if (source === "staticFile" && doc.fileRef) {
      format.file = { _type: "file", asset: { _type: "reference", _ref: doc.fileRef } };
    }
    if (source === "externalLink" && doc.externalUrl) format.externalUrl = doc.externalUrl;
    if (source === "generated" && doc.templateId) format.templateId = doc.templateId;

    const patch: Record<string, unknown> = { formats: [format] };
    if (!doc.slug?.current) {
      patch.slug = { _type: "slug", current: slugify(doc.title) };
    }

    tx.patch(doc._id, (p) =>
      p.set(patch).unset(["assetType", "file", "externalUrl", "templateId", "instructions"]),
    );
    console.log(`  ${doc.title} → ${format.platform} (${source})`);
  }

  await tx.commit();
  console.log(`Migrated ${pending.length} resource(s).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
