import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { recordHash } from "../src/lib/schoolMigration.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const script = path.join(root, "scripts/school-migration.mjs");
const run = (args: string[]) => spawnSync(process.execPath, ["--experimental-strip-types", script, ...args], {
  cwd: root, encoding: "utf8", env: { PATH: process.env.PATH },
});

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "school-migration-test-"));
  const docs = [{ _id: "school.test", _type: "school", _rev: "revision", slug: { current: "test" }, secretField: "SECRET-DO-NOT-PRINT", custom: [1, null, false] }];
  const raw = JSON.stringify(docs);
  await writeFile(path.join(directory, "records.json"), raw);
  await writeFile(path.join(directory, "manifest.json"), JSON.stringify({
    formatVersion: 1, projectId: "testproject", dataset: "test", perspective: "raw", complete: true,
    sourceHash: recordHash(docs),
    files: [{ path: "records.json", bytes: Buffer.byteLength(raw), sha256: createHash("sha256").update(raw).digest("hex") }],
  }));
  return directory;
}

test("offline planning preserves raw backup and never requires credentials or prints document values", async () => {
  const directory = await fixture();
  try {
    const before = await readFile(path.join(directory, "records.json"), "utf8");
    const result = run(["plan", "--from", directory, "--out", path.join(directory, "plan")]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).ready, true);
    assert(!result.stdout.includes("SECRET-DO-NOT-PRINT"));
    assert.equal(await readFile(path.join(directory, "records.json"), "utf8"), before);
    const plan = JSON.parse(await readFile(path.join(directory, "plan", "plan.json"), "utf8"));
    assert.deepEqual(plan.entries[0].changedPaths, ["/managementMigratedAt", "/managementMigrationId", "/managementVersion"]);
    assert(!JSON.stringify(plan).includes("SECRET-DO-NOT-PRINT"));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("tampered backup fails closed before planning", async () => {
  const directory = await fixture();
  try {
    await writeFile(path.join(directory, "records.json"), "[]");
    const result = run(["plan", "--from", directory, "--out", path.join(directory, "plan")]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Backup integrity failure/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("read-only modes reject an accidental apply flag", async () => {
  const result = run(["backup", "--out", "/unused", "--apply"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /read-only/);
});

test("plan output refuses to overwrite an earlier reviewed plan", async () => {
  const directory = await fixture();
  try {
    const args = ["plan", "--from", directory, "--out", path.join(directory, "plan")];
    assert.equal(run(args).status, 0);
    const before = await readFile(path.join(directory, "plan", "plan.json"), "utf8");
    assert.notEqual(run(args).status, 0);
    assert.equal(await readFile(path.join(directory, "plan", "plan.json"), "utf8"), before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
