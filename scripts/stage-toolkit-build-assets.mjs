#!/usr/bin/env node
// Explicitly stage one verified private toolkit edition for reproducible builds.
// Default: dry-run. --write-manifest writes hashes/IDs only to the public repo.
// --stage creates absent private draft artifact docs; it never overwrites data.
import { createClient } from "@sanity/client";
import { readFile, writeFile, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  BUILD_MANIFEST_PATH, BUILD_ARTIFACT_TYPE, sha256, validateBuildManifest,
  verifyArtifactDocuments, fetchArtifactDocuments,
} from "./prepare-toolkit-content.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHUNK_BYTES = 524288;
async function jsonFiles(root, relative) {
  const files = [];
  for (const entry of await readdir(path.join(root, relative), { withFileTypes: true })) {
    const filename = `${relative}/${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error("Protected build inputs must not use symlinks");
    if (entry.isDirectory()) files.push(...await jsonFiles(root, filename));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(filename);
  }
  return files;
}

export function createBuildArtifactPackage(files, { release, projectId = "xjhhxbqk", dataset = "production", counts = {} }) {
  const artifacts = [];
  const manifestFiles = [...files].sort((a, b) => a.path.localeCompare(b.path)).map((file) => {
    const bytes = Buffer.from(file.bytes);
    const fileSha256 = sha256(bytes), fileKey = sha256(file.path).slice(0, 16);
    const partCount = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTES));
    const parts = [];
    for (let index = 0; index < partCount; index++) {
      const chunk = bytes.subarray(index * CHUNK_BYTES, (index + 1) * CHUNK_BYTES);
      const id = `drafts.xp-toolkit.build.${release.revision}.${fileKey}.${index}`;
      const partSha256 = sha256(chunk);
      const artifact = {
        _id: id, _type: BUILD_ARTIFACT_TYPE, releaseVersion: release.version, releaseRevision: release.revision,
        artifactPath: file.path, fileSha256, fileBytes: bytes.length, partIndex: index, partCount,
        partSha256, encoding: "base64", data: chunk.toString("base64"),
      };
      if (Buffer.byteLength(JSON.stringify(artifact)) >= 1_000_000) throw new Error("Artifact exceeds the conservative one-megabyte document budget");
      artifacts.push(artifact);
      parts.push({ index, documentId: id, bytes: chunk.length, sha256: partSha256 });
    }
    return { path: file.path, bytes: bytes.length, sha256: fileSha256, parts };
  });
  const manifest = { schemaVersion: 1, documentType: BUILD_ARTIFACT_TYPE, perspective: "raw", projectId, dataset, release, counts, files: manifestFiles };
  validateBuildManifest(manifest);
  verifyArtifactDocuments(manifest, artifacts);
  return { manifest, artifacts };
}

async function readVerifiedPackage() {
  // This checks canonical-source consistency plus the six retained binaries.
  // Output contains version/counts only; it is not a content export.
  execFileSync(process.execPath, ["scripts/build-toolkit-content.mjs", "--check"], { cwd: repositoryRoot, stdio: "pipe" });
  const publication = JSON.parse(await readFile(path.join(repositoryRoot, "src/data/toolkit/content.json"), "utf8"));
  if (!publication.generated || publication.schemaVersion !== 1 || publication.resources.length !== 6) throw new Error("Expected the current verified six-resource generated edition");
  const filenames = ["src/data/toolkit/content.json", "src/data/toolkit/sanity-export.ndjson",
    ...await jsonFiles(repositoryRoot, "src/data/toolkit/masters"), ...await jsonFiles(repositoryRoot, "src/data/toolkit/downloads")];
  const files = await Promise.all(filenames.map(async (filename) => ({ path: filename, bytes: await readFile(path.join(repositoryRoot, filename)) })));
  return createBuildArtifactPackage(files, {
    release: publication.release, projectId: process.env.SANITY_PROJECT_ID || "xjhhxbqk", dataset: process.env.SANITY_DATASET || "production",
    counts: { resources: publication.resources.length, articles: publication.articles.length, standardDownloads: 6 },
  });
}

async function main() {
  process.umask(0o077);
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log("Default is local dry-run. --write-manifest records only safe file paths, hashes, sizes and private document IDs. --stage requires SANITY_WRITE_TOKEN, checks existing artifacts, creates missing draft chunks with createIfNotExists, then verifies exact readback. A staged revision is immutable; content changes require a new revision.");
    return;
  }
  if (args.some((arg) => !["--write-manifest", "--stage"].includes(arg))) throw new Error("Unknown argument; use --help");
  const { manifest, artifacts } = await readVerifiedPackage();
  const manifestPath = path.join(repositoryRoot, BUILD_MANIFEST_PATH);
  const manifestBytes = `${JSON.stringify(manifest, null, 2)}\n`;
  if (args.includes("--write-manifest")) await writeFile(manifestPath, manifestBytes, { mode: 0o644 });
  else {
    try {
      if (await readFile(manifestPath, "utf8") !== manifestBytes) throw new Error("Manifest differs; review the hash-only manifest with --write-manifest first");
    } catch (error) { if (error.code === "ENOENT") throw new Error("Create/review the hash-only build manifest with --write-manifest first"); else throw error; }
  }
  const summary = { mode: args.includes("--stage") ? "stage-private-drafts" : "dry-run", version: manifest.release.version, revision: manifest.release.revision,
    files: manifest.files.length, chunks: artifacts.length, largestDocumentBytes: Math.max(...artifacts.map((doc) => Buffer.byteLength(JSON.stringify(doc)))),
    contentBytes: manifest.files.reduce((total, file) => total + file.bytes, 0) };
  if (args.includes("--stage")) {
    if (!process.env.SANITY_WRITE_TOKEN) throw new Error("SANITY_WRITE_TOKEN is required for explicit private artifact staging");
    const source = createClient({ projectId: manifest.projectId, dataset: manifest.dataset, apiVersion: "2025-02-19", perspective: "raw", useCdn: false, token: process.env.SANITY_WRITE_TOKEN, timeout: 30_000 });
    const existing = await fetchArtifactDocuments(source, artifacts.map((doc) => doc._id));
    const missing = [];
    for (const artifact of artifacts) {
      const current = existing.find((doc) => doc._id === artifact._id);
      if (!current) { missing.push(artifact); continue; }
      for (const key of Object.keys(artifact)) if (current[key] !== artifact[key]) throw new Error("An immutable build artifact already differs; create a new release revision instead of replacing it");
    }
    for (let index = 0; index < missing.length; index += 4) {
      let transaction = source.transaction();
      for (const artifact of missing.slice(index, index + 4)) transaction = transaction.createIfNotExists(artifact);
      await transaction.commit({ visibility: "sync", returnDocuments: false });
    }
    const readback = await fetchArtifactDocuments(source, artifacts.map((doc) => doc._id));
    verifyArtifactDocuments(manifest, readback);
    summary.createdDraftChunksRequested = missing.length;
    summary.exactReadbackVerified = true;
    summary.publishedDocumentsChanged = 0;
  }
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error?.statusCode ? `Private toolkit artifact operation failed (HTTP ${error.statusCode}); no overwrite attempted` : String(error?.message || "Private artifact preparation failed").replace(/https?:\/\/\S+/g, "[URL]"));
    process.exitCode = 1;
  });
}
