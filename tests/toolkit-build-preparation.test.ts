import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, rm, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createBuildArtifactPackage } from "../scripts/stage-toolkit-build-assets.mjs";
import { prepareToolkitContent, protectedToolkitPath, verifyArtifactDocuments, validateBuildManifest } from "../scripts/prepare-toolkit-content.mjs";

const resourceIds = ["guide", "catalog", "builder", "communications", "kickoff", "rules"];
function fixture(large = false) {
  const filenames = ["src/data/toolkit/content.json", "src/data/toolkit/sanity-export.ndjson", "src/data/toolkit/masters/release-manifest.json", ...resourceIds.map((id) => `src/data/toolkit/downloads/${id}.json`)];
  const files = filenames.map((filename, index) => ({ path: filename, bytes: large && index === 0 ? Buffer.alloc(1_200_000, 120) : Buffer.from(`SYNTHETIC PRIVATE FIXTURE ${index}`) }));
  return { files, ...createBuildArtifactPackage(files, { release: { version: "test", revision: "test-release", date: "2026-01-01" } }) };
}

test("tracked manifest contains only hashes, sizes and identifiers, while documents stay below one MB", () => {
  const { files, manifest, artifacts } = fixture(true);
  assert(!JSON.stringify(manifest).includes("SYNTHETIC PRIVATE FIXTURE"));
  assert(artifacts.every((doc: { _id: string }) => doc._id.startsWith("drafts.xp-toolkit.build.")));
  assert(artifacts.every((doc: unknown) => Buffer.byteLength(JSON.stringify(doc)) < 1_000_000));
  assert.equal(manifest.files.find((file: { path: string }) => file.path.endsWith("content.json")).parts.length, 3);
  assert.deepEqual(verifyArtifactDocuments(manifest, artifacts), [...files].sort((a, b) => a.path.localeCompare(b.path)));
});

test("missing protected inputs fail closed without credentials before fetching anything", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "toolkit-preparation-test-"));
  try {
    const { manifest } = fixture();
    await assert.rejects(prepareToolkitContent({ root, manifest, token: "", fetchDocuments: async () => { throw new Error("Must not fetch"); } }), /SANITY_READ_TOKEN is required/);
    await assert.rejects(readFile(path.join(root, "src/data/toolkit/content.json")), { code: "ENOENT" });
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("authenticated preparation restores exact bytes then supports verified local cache without credentials", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "toolkit-preparation-test-"));
  try {
    const { files, manifest, artifacts } = fixture();
    const result = await prepareToolkitContent({ root, manifest, token: "synthetic-token", fetchDocuments: async () => artifacts });
    assert.equal(result.source, "private-sanity");
    for (const file of files) {
      assert.deepEqual(await readFile(path.join(root, file.path)), file.bytes);
      assert.equal((await stat(path.join(root, file.path))).mode & 0o777, 0o600);
    }
    const cached = await prepareToolkitContent({ root, manifest, token: "", fetchDocuments: async () => { throw new Error("Must not fetch verified cache"); } });
    assert.equal(cached.source, "verified-local-cache");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("one corrupt or missing chunk prevents the entire package from being written", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "toolkit-preparation-test-"));
  try {
    const { manifest, artifacts } = fixture();
    const corrupt = artifacts.map((doc: unknown, index: number) => index ? doc : { ...doc as object, data: Buffer.from("tampered").toString("base64") });
    await assert.rejects(prepareToolkitContent({ root, manifest, token: "synthetic-token", fetchDocuments: async () => corrupt }), /integrity failure/);
    await assert.rejects(readFile(path.join(root, "src/data/toolkit/content.json")), { code: "ENOENT" });
    assert.throws(() => verifyArtifactDocuments(manifest, artifacts.slice(1)), /Missing or mismatched/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("a modified local file cannot silently bypass credential requirements", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "toolkit-preparation-test-"));
  try {
    const { manifest, artifacts } = fixture();
    await prepareToolkitContent({ root, manifest, token: "synthetic-token", fetchDocuments: async () => artifacts });
    await writeFile(path.join(root, "src/data/toolkit/content.json"), "unreviewed local modification");
    await assert.rejects(prepareToolkitContent({ root, manifest, token: "" }), /missing or stale/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("manifest paths cannot restore arbitrary source files or traverse directories", () => {
  for (const filename of ["src/pages/index.astro", "/tmp/leak.json", "src/data/toolkit/masters/../../leak.json", "src/data/toolkit/masters//leak.json", "src\\data\\toolkit\\content.json"]) assert.equal(protectedToolkitPath(filename), false);
  const { manifest } = fixture();
  assert.throws(() => validateBuildManifest({ ...manifest, files: [{ ...manifest.files[0], path: "src/pages/index.astro" }, ...manifest.files.slice(1)] }), /Invalid protected toolkit file/);
});
