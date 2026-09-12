#!/usr/bin/env node
// Restore protected, ignored build inputs from private Sanity draft documents.
// This must run before Astro/TypeScript loads JSON imports. No content is public
// merely because the application code repository is public.
import { createClient } from "@sanity/client";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, mkdtemp, rename, rm, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const BUILD_MANIFEST_PATH = "src/data/toolkit/build-manifest.json";
export const BUILD_ARTIFACT_TYPE = "xpToolkitBuildArtifact";
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

export function protectedToolkitPath(filename) {
  return typeof filename === "string" && !filename.includes("\\") && !filename.split("/").some((part) => part === ".." || part === "." || part === "") && (
    filename === "src/data/toolkit/content.json" || filename === "src/data/toolkit/sanity-export.ndjson" ||
    /^src\/data\/toolkit\/(masters|downloads)\/[A-Za-z0-9_./-]+\.json$/.test(filename)
  );
}

export function validateBuildManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.documentType !== BUILD_ARTIFACT_TYPE || manifest.perspective !== "raw" ||
      !/^[a-z0-9]+$/.test(manifest.projectId || "") || !/^[a-z0-9_-]+$/.test(manifest.dataset || "") ||
      !/^[A-Za-z0-9_-]+$/.test(manifest.release?.revision || "") || !Array.isArray(manifest.files) || !manifest.files.length) throw new Error("Invalid protected toolkit build manifest");
  const paths = new Set(), ids = new Set();
  for (const file of manifest.files) {
    if (!protectedToolkitPath(file.path) || paths.has(file.path) || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256 || "") || !Array.isArray(file.parts) || !file.parts.length) throw new Error("Invalid protected toolkit file entry");
    paths.add(file.path);
    let bytes = 0;
    file.parts.forEach((part, index) => {
      if (part.index !== index || !Number.isSafeInteger(part.bytes) || part.bytes < 0 || part.bytes > 524288 ||
          !/^[a-f0-9]{64}$/.test(part.sha256 || "") || typeof part.documentId !== "string" ||
          !part.documentId.startsWith(`drafts.xp-toolkit.build.${manifest.release.revision}.`) ||
          part.documentId.length > 128 || ids.has(part.documentId)) throw new Error("Invalid protected toolkit chunk entry");
      ids.add(part.documentId); bytes += part.bytes;
    });
    if (bytes !== file.bytes) throw new Error("Protected toolkit chunk sizes do not match their file");
  }
  if (!paths.has("src/data/toolkit/content.json") || !paths.has("src/data/toolkit/sanity-export.ndjson") ||
      !paths.has("src/data/toolkit/masters/release-manifest.json") ||
      ["guide", "catalog", "builder", "communications", "kickoff", "rules"].some((id) => !paths.has(`src/data/toolkit/downloads/${id}.json`))) throw new Error("Build manifest must include the entire six-resource package");
  return manifest;
}

export function verifyArtifactDocuments(manifest, documents) {
  validateBuildManifest(manifest);
  const byId = new Map(documents.map((doc) => [doc?._id, doc]));
  if (byId.size !== documents.length) throw new Error("Duplicate protected artifact documents");
  const result = [];
  for (const file of manifest.files) {
    const chunks = file.parts.map((part) => {
      const document = byId.get(part.documentId);
      if (!document || document._type !== BUILD_ARTIFACT_TYPE || document.releaseRevision !== manifest.release.revision ||
          document.artifactPath !== file.path || document.fileSha256 !== file.sha256 || document.fileBytes !== file.bytes ||
          document.partIndex !== part.index || document.partCount !== file.parts.length || document.partSha256 !== part.sha256 ||
          document.encoding !== "base64" || typeof document.data !== "string") throw new Error("Missing or mismatched protected toolkit artifact");
      const bytes = Buffer.from(document.data, "base64");
      if (bytes.length !== part.bytes || sha256(bytes) !== part.sha256) throw new Error("Protected toolkit chunk integrity failure");
      return bytes;
    });
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error("Protected toolkit file integrity failure");
    result.push({ path: file.path, bytes });
  }
  return result;
}

async function noSymlinkParents(root, filename) {
  const segments = filename.split("/");
  for (let index = 1; index <= segments.length; index++) {
    try {
      if ((await lstat(path.join(root, ...segments.slice(0, index)))).isSymbolicLink()) throw new Error("Refusing a symlink in protected toolkit build paths");
    } catch (error) { if (error.code !== "ENOENT") throw error; }
  }
}

export async function verifyLocalToolkitFiles(root, manifest) {
  validateBuildManifest(manifest);
  const invalid = [];
  for (const file of manifest.files) {
    await noSymlinkParents(root, file.path);
    try {
      const bytes = await readFile(path.join(root, file.path));
      if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) invalid.push(file.path);
    } catch (error) { if (error.code === "ENOENT") invalid.push(file.path); else throw error; }
  }
  return invalid;
}

export async function fetchArtifactDocuments(source, ids) {
  const documents = [];
  // Keep each response below about 3 MB and preserve raw drafts exactly.
  for (let index = 0; index < ids.length; index += 4) {
    documents.push(...await source.fetch('*[_id in $ids]', { ids: ids.slice(index, index + 4) }));
  }
  return documents;
}

export async function prepareToolkitContent({ root = repositoryRoot, manifest, token = process.env.SANITY_READ_TOKEN, fetchDocuments } = {}) {
  manifest ||= JSON.parse(await readFile(path.join(root, BUILD_MANIFEST_PATH), "utf8"));
  validateBuildManifest(manifest);
  const invalid = await verifyLocalToolkitFiles(root, manifest);
  if (!invalid.length) return { source: "verified-local-cache", files: manifest.files.length, revision: manifest.release.revision };
  if (!token) throw new Error("Protected toolkit inputs are missing or stale. SANITY_READ_TOKEN is required before this build can proceed; no empty or public fallback is allowed.");
  const ids = manifest.files.flatMap((file) => file.parts.map((part) => part.documentId));
  const source = fetchDocuments ? undefined : createClient({ projectId: manifest.projectId, dataset: manifest.dataset, apiVersion: "2025-02-19", perspective: "raw", useCdn: false, token, timeout: 30_000 });
  const documents = fetchDocuments ? await fetchDocuments(ids) : await fetchArtifactDocuments(source, ids);
  const restored = verifyArtifactDocuments(manifest, documents);
  // No destination is touched until the entire package passes every hash.
  // Staging stays in the Git-ignored private backup folder on the same volume.
  const privateRoot = path.join(root, ".local-backups");
  await noSymlinkParents(root, ".local-backups");
  await mkdir(privateRoot, { recursive: true, mode: 0o700 });
  const staging = await mkdtemp(path.join(privateRoot, ".toolkit-prepare-"));
  try {
    for (let index = 0; index < restored.length; index++) await writeFile(path.join(staging, String(index)), restored[index].bytes, { mode: 0o600, flag: "wx" });
    for (let index = 0; index < restored.length; index++) {
      const file = restored[index];
      await noSymlinkParents(root, file.path);
      const destination = path.join(root, file.path);
      await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
      await rename(path.join(staging, String(index)), destination);
    }
  } finally { await rm(staging, { recursive: true, force: true }); }
  if ((await verifyLocalToolkitFiles(root, manifest)).length) throw new Error("Restored toolkit inputs failed final verification");
  return { source: "private-sanity", files: manifest.files.length, chunks: ids.length, revision: manifest.release.revision };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.umask(0o077);
  prepareToolkitContent().then((summary) => console.log(JSON.stringify(summary, null, 2))).catch((error) => {
    console.error(error?.statusCode ? `Protected toolkit read failed (HTTP ${error.statusCode}); build stopped` : String(error?.message || "Protected toolkit preparation failed; build stopped").replace(/https?:\/\/\S+/g, "[URL]"));
    process.exitCode = 1;
  });
}
