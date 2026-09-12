#!/usr/bin/env node
// Node 22: node --env-file=.env --experimental-strip-types scripts/school-migration.mjs --help
// Credentials are read from the environment; neither values nor raw documents
// are printed. Raw backups contain private data and must stay outside Git.
import { createClient } from "@sanity/client";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, chmod, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import {
  SCHOOL_DOCUMENT_TYPES, MANAGEMENT_FIELDS, recordHash, canonicalJson,
  collectAssetDependencies, planSchoolMigration, replayMigrationEntry, inventorySchools,
} from "../src/lib/schoolMigration.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const safeError = (error) => {
  // Do not serialize SDK exceptions: request headers may contain credentials.
  if (error?.statusCode) return `Sanity request failed (HTTP ${error.statusCode})`;
  if (error?.cause?.code) return `Network request failed (${error.cause.code})`;
  return String(error?.message ?? "Operation failed").replace(/https?:\/\/\S+/g, "[URL]");
};

function options(args) {
  const [command = "help", ...rest] = args;
  const result = { command };
  const bools = new Set(["assets", "apply"]);
  const values = new Set(["out", "from", "org-map", "migration-id", "journal"]);
  for (let index = 0; index < rest.length; index++) {
    const key = rest[index].replace(/^--/, "");
    if (rest[index] === "--help") return { command: "help" };
    if (!rest[index].startsWith("--") || (!bools.has(key) && !values.has(key))) throw new Error("Unknown argument");
    if (bools.has(key)) result[key] = true;
    else {
      if (!rest[index + 1] || rest[index + 1].startsWith("--")) throw new Error(`Missing --${key} value`);
      result[key] = rest[++index];
    }
  }
  return result;
}

function client(write = false) {
  const token = process.env[write ? "SANITY_WRITE_TOKEN" : "SANITY_READ_TOKEN"];
  if (!token) throw new Error(`${write ? "SANITY_WRITE_TOKEN" : "SANITY_READ_TOKEN"} is required`);
  return createClient({
    projectId: process.env.SANITY_PROJECT_ID || "xjhhxbqk",
    dataset: process.env.SANITY_DATASET || "production",
    token, apiVersion: "2025-02-19", perspective: "raw", useCdn: false,
    timeout: 60_000,
  });
}

async function privateDirectory(directory) {
  await mkdir(directory, { mode: 0o700 }); // refuses to reuse/overwrite a backup
  await chmod(directory, 0o700);
}
async function privateJson(filename, value) {
  await writeFile(filename, `${JSON.stringify(value, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

async function allSchoolRecords(source) {
  const records = [];
  let after = "";
  while (true) {
    const batch = await source.fetch(
      `*[_type in $types && _id > $after] | order(_id asc) [0...500]`,
      { types: [...SCHOOL_DOCUMENT_TYPES], after },
    );
    records.push(...batch);
    if (batch.length < 500) break;
    after = batch.at(-1)._id;
  }
  return records;
}
async function byIds(source, ids) {
  const result = [];
  for (let index = 0; index < ids.length; index += 200) {
    result.push(...await source.fetch(`*[_id in $ids]`, { ids: ids.slice(index, index + 200) }));
  }
  return result.sort((a, b) => a._id.localeCompare(b._id));
}

function summary(inventory, plan) {
  return {
    publishedSchools: inventory.publishedSchools, draftSchools: inventory.draftSchools,
    partners: inventory.partners, documentCounts: inventory.counts,
    changes: plan.entries.filter((entry) => entry.changedPaths.length).length,
    errors: plan.issues.filter((issue) => issue.severity === "error").length,
    warnings: plan.issues.filter((issue) => issue.severity === "warning").length,
    issueCounts: plan.issues.reduce((counts, issue) => ({ ...counts, [issue.code]: (counts[issue.code] || 0) + 1 }), {}),
  };
}

async function backup(args) {
  if (args.apply) throw new Error("backup is read-only; --apply is not accepted");
  if (!args.out) throw new Error("--out must name a new private directory outside the repository");
  const directory = path.resolve(args.out);
  if (directory === root || directory.startsWith(`${root}${path.sep}`)) throw new Error("Raw backups must be outside the repository");
  await privateDirectory(directory);
  const files = [];
  const save = async (name, bytes) => {
    await writeFile(path.join(directory, name), bytes, { mode: 0o600, flag: "wx" });
    files.push({ path: name, bytes: Buffer.byteLength(bytes), sha256: sha256(bytes) });
  };
  const source = client();
  const config = source.config();
  const startedAt = new Date().toISOString();
  try {
    const records = await allSchoolRecords(source);
    const dependencies = collectAssetDependencies(records);
    const assets = await byIds(source, dependencies.refs);
    const missingAssets = dependencies.refs.filter((id) => !assets.some((asset) => asset._id === id));
    const urls = [...new Set([...dependencies.urls, ...assets.map((asset) => asset.url).filter(Boolean)])].sort();
    const inventory = inventorySchools(records);
    const plan = planSchoolMigration(records, { migrationId: "inventory-only", plannedAt: startedAt });
    await save("records.json", `${JSON.stringify(records, null, 2)}\n`);
    await save("records.ndjson", records.map((doc) => JSON.stringify(doc)).join("\n") + "\n");
    await save("asset-records.json", `${JSON.stringify(assets, null, 2)}\n`);
    await save("inventory.json", `${JSON.stringify(inventory, null, 2)}\n`);
    await save("issues.json", `${JSON.stringify(plan.issues, null, 2)}\n`);
    const downloaded = [];
    if (args.assets) {
      await privateDirectory(path.join(directory, "assets"));
      for (const url of urls) {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" || parsed.hostname !== "cdn.sanity.io" || !/^\/(images|files)\//.test(parsed.pathname)) {
          throw new Error("An asset uses an unsupported origin; preserve the reference and review manually");
        }
        const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(60_000) });
        if (!response.ok) throw new Error(`Asset download failed (HTTP ${response.status})`);
        const bytes = Buffer.from(await response.arrayBuffer());
        const name = `assets/${sha256(url)}${path.extname(parsed.pathname).replace(/[^.a-zA-Z0-9]/g, "")}`;
        await save(name, bytes);
        downloaded.push({ url, path: name, bytes: bytes.length, sha256: sha256(bytes) });
      }
    }
    await save("asset-dependencies.json", `${JSON.stringify({ ...dependencies, missingAssets, downloadsRequested: !!args.assets, downloaded }, null, 2)}\n`);
    // No snapshot guarantee is assumed across paginated reads or downloads.
    // A second complete read rejects a moving source rather than blessing it.
    const current = await allSchoolRecords(source);
    const currentAssets = await byIds(source, dependencies.refs);
    const stable = recordHash([...records].sort((a, b) => a._id.localeCompare(b._id))) ===
      recordHash([...current].sort((a, b) => a._id.localeCompare(b._id))) && recordHash(assets) === recordHash(currentAssets);
    const manifest = {
      formatVersion: 1, projectId: config.projectId, dataset: config.dataset,
      perspective: "raw", documentTypes: SCHOOL_DOCUMENT_TYPES, startedAt,
      finishedAt: new Date().toISOString(), complete: stable && missingAssets.length === 0,
      recordsStable: stable, assetsDownloaded: !!args.assets, assetDocumentCount: assets.length,
      assetBinaryCount: downloaded.length, missingAssetCount: missingAssets.length,
      sourceHash: plan.sourceHash, summary: summary(inventory, plan), files,
    };
    await privateJson(path.join(directory, "manifest.json"), manifest);
    console.log(JSON.stringify({ backup: directory, ...manifest.summary, complete: manifest.complete,
      assetDocuments: assets.length, assetBinaries: downloaded.length, missingAssets: missingAssets.length }, null, 2));
    if (!manifest.complete) process.exitCode = 2;
  } catch (error) {
    await privateJson(path.join(directory, "failure.json"), { complete: false, startedAt, message: safeError(error), files });
    throw error;
  }
}

async function loadBackup(directory) {
  if (!directory) throw new Error("--from backup directory is required");
  const base = path.resolve(directory);
  const manifest = JSON.parse(await readFile(path.join(base, "manifest.json"), "utf8"));
  if (!manifest.complete || manifest.perspective !== "raw" || manifest.formatVersion !== 1) throw new Error("Backup is incomplete or unsupported");
  for (const file of manifest.files) {
    if (path.isAbsolute(file.path) || file.path.split(/[\\/]/).includes("..")) throw new Error("Invalid backup path");
    const bytes = await readFile(path.join(base, file.path));
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) throw new Error(`Backup integrity failure: ${file.path}`);
  }
  const records = JSON.parse(await readFile(path.join(base, "records.json"), "utf8"));
  if (recordHash([...records].sort((a, b) => a._id.localeCompare(b._id))) !== manifest.sourceHash) throw new Error("Backup source hash mismatch");
  return { base, manifest, records };
}

async function plan(args) {
  if (args.apply) throw new Error("plan never writes live data; use apply with a reviewed plan");
  if (!args.out) throw new Error("--out new plan directory is required");
  const snapshot = await loadBackup(args.from);
  await privateDirectory(path.resolve(args.out));
  const orgByPartnerId = args["org-map"] ? JSON.parse(await readFile(args["org-map"], "utf8")) : {};
  if (!orgByPartnerId || typeof orgByPartnerId !== "object" || Array.isArray(orgByPartnerId)) throw new Error("Org map must be a JSON object");
  const migration = planSchoolMigration(snapshot.records, {
    migrationId: args["migration-id"] || "school-management-v2",
    plannedAt: new Date().toISOString(), orgByPartnerId,
  });
  for (const entry of migration.entries) replayMigrationEntry(snapshot.records.find((doc) => doc._id === entry.id), entry);
  await privateJson(path.join(args.out, "plan.json"), { ...migration,
    backupDirectory: snapshot.base, projectId: snapshot.manifest.projectId, dataset: snapshot.manifest.dataset, orgByPartnerId });
  console.log(JSON.stringify({ plan: path.resolve(args.out, "plan.json"), ready: migration.ready,
    ...summary(inventorySchools(snapshot.records), migration) }, null, 2));
  if (!migration.ready) process.exitCode = 2;
}

async function loadPlan(filename) {
  if (!filename) throw new Error("--from reviewed plan.json is required");
  const migration = JSON.parse(await readFile(filename, "utf8"));
  const snapshot = await loadBackup(migration.backupDirectory);
  const recomputed = planSchoolMigration(snapshot.records, migration);
  for (const key of ["sourceHash", "entries", "issues", "ready"]) {
    if (canonicalJson(migration[key]) !== canonicalJson(recomputed[key])) throw new Error("Plan does not match its verified backup and mapping");
  }
  if (!migration.ready || migration.projectId !== snapshot.manifest.projectId || migration.dataset !== snapshot.manifest.dataset) throw new Error("Plan is blocked or source identity differs");
  return { migration, snapshot };
}

const withoutServerRevision = (doc) => {
  if (!doc) return null;
  const { _rev, _updatedAt, ...content } = doc;
  return content;
};

async function applyOrReconcile(args) {
  const { migration, snapshot } = await loadPlan(args.from);
  const source = client(args.command !== "reconcile");
  if (source.config().projectId !== migration.projectId || source.config().dataset !== migration.dataset) throw new Error("Configured destination differs from backup");
  const entries = migration.entries.filter((entry) => entry.changedPaths.length);
  const current = await allSchoolRecords(source);
  const states = entries.map((entry) => {
    const old = snapshot.records.find((doc) => doc._id === entry.id);
    const now = current.find((doc) => doc._id === entry.id);
    const before = recordHash(withoutServerRevision(old));
    const after = recordHash(withoutServerRevision(replayMigrationEntry(old, entry)));
    const actual = recordHash(withoutServerRevision(now));
    return { id: entry.id, state: actual === before ? "before" : actual === after ? "applied" : "conflict" };
  });
  if (args.command === "reconcile") {
    console.log(JSON.stringify({ migrationId: migration.migrationId, states }, null, 2));
    if (states.some((item) => item.state === "conflict")) process.exitCode = 2;
    return;
  }
  if (!args.apply) throw new Error("Live metadata changes require the explicit --apply flag; plan and reconcile are read-only");
  if (!args.journal) throw new Error("--journal new private directory is required before any write");
  if (entries.length > 500) throw new Error("Plan exceeds 500 patches; split into independently reviewed migrations before applying");
  if (args.command === "apply") {
    if (entries.length && states.every((item) => item.state === "applied")) {
      console.log(JSON.stringify({ status: "already_applied", patches: 0, migrationId: migration.migrationId }, null, 2));
      return;
    }
    if (recordHash([...current].sort((a, b) => a._id.localeCompare(b._id))) !== migration.sourceHash) {
      throw new Error("Source changed since backup. Run reconcile; create a fresh backup and plan if needed");
    }
  } else if (args.command === "rollback") {
    if (states.some((item) => item.state === "conflict")) throw new Error("Rollback stopped: content changed beyond migration metadata; inspect conflicts first");
  }
  await privateDirectory(path.resolve(args.journal));
  await privateJson(path.join(args.journal, "requested.json"), {
    command: args.command, requestedAt: new Date().toISOString(), planFile: path.resolve(args.from),
    migrationId: migration.migrationId, sourceHash: migration.sourceHash, states,
  });
  let transaction = source.transaction();
  let patches = 0;
  for (const entry of entries) {
    const now = current.find((doc) => doc._id === entry.id);
    if (!now?._rev) throw new Error("Current record lacks a revision");
    if (args.command === "rollback" && states.find((item) => item.id === entry.id).state === "before") continue;
    const old = snapshot.records.find((doc) => doc._id === entry.id);
    if (args.command === "apply") transaction = transaction.patch(entry.id, (patch) => patch.ifRevisionId(now._rev).set(entry.set));
    else {
      const set = Object.fromEntries(MANAGEMENT_FIELDS.filter((key) => key in entry.set && key in old).map((key) => [key, old[key]]));
      const unset = MANAGEMENT_FIELDS.filter((key) => key in entry.set && !(key in old));
      transaction = transaction.patch(entry.id, (patch) => {
        let guarded = patch.ifRevisionId(now._rev);
        if (Object.keys(set).length) guarded = guarded.set(set);
        if (unset.length) guarded = guarded.unset(unset);
        return guarded;
      });
    }
    patches++;
  }
  try {
    const result = patches ? await transaction.commit({ visibility: "sync", returnDocuments: false }) : { transactionId: null };
    await privateJson(path.join(args.journal, "result.json"), {
      status: "committed", command: args.command, patches, transactionId: result.transactionId,
      finishedAt: new Date().toISOString(),
    });
    console.log(JSON.stringify({ status: "committed", patches, journal: path.resolve(args.journal) }, null, 2));
  } catch (error) {
    await privateJson(path.join(args.journal, "uncertain.json"), {
      status: "reconcile_required", message: safeError(error), finishedAt: new Date().toISOString(),
    });
    throw new Error("Commit was not confirmed. Do not retry blindly: run reconcile with this plan before any next write");
  }
}

async function exportProject(args) {
  if (args.apply) throw new Error("export-project is read-only");
  if (!args.out) throw new Error("--out new backup directory is required");
  const directory = path.resolve(args.out);
  if (directory === root || directory.startsWith(`${root}${path.sep}`)) throw new Error("Project exports must be outside the repository");
  const source = client();
  if (source.config().projectId !== "xjhhxbqk") {
    throw new Error("export-project uses the Studio CLI project xjhhxbqk; configure and verify its sanity.cli.ts before exporting another project");
  }
  const datasets = await source.datasets.list();
  const executable = path.join(root, "studio/node_modules/.bin/sanity");
  await stat(executable);
  await privateDirectory(directory);
  const exports = [];
  for (const dataset of datasets) {
    if (!/^[a-z0-9_-]+$/.test(dataset.name)) throw new Error("Unexpected dataset name");
    const filename = path.join(directory, `${dataset.name}.tar.gz`);
    // stdio is retained privately because CLI exceptions can include request
    // metadata. Credentials are environment variables, never command arguments.
    const chunks = [];
    const code = await new Promise((resolve, reject) => {
      const child = spawn(executable, ["dataset", "export", dataset.name, filename], {
        cwd: path.join(root, "studio"),
        env: { ...process.env, SANITY_AUTH_TOKEN: process.env.SANITY_READ_TOKEN, SANITY_STUDIO_PROJECT_ID: source.config().projectId },
        stdio: ["ignore", "pipe", "pipe"],
      });
      child.stdout.on("data", (bytes) => chunks.push(bytes));
      child.stderr.on("data", (bytes) => chunks.push(bytes));
      child.on("error", reject); child.on("close", resolve);
    });
    await writeFile(path.join(directory, `${dataset.name}.cli.log`), Buffer.concat(chunks), { mode: 0o600, flag: "wx" });
    if (code !== 0) throw new Error(`Dataset export failed (exit ${code}); inspect private CLI log`);
    await chmod(filename, 0o600);
    const bytes = await readFile(filename);
    exports.push({ dataset: dataset.name, file: path.basename(filename), bytes: bytes.length, sha256: sha256(bytes) });
  }
  await privateJson(path.join(directory, "project-export.json"), {
    projectId: source.config().projectId, complete: true, exportedAt: new Date().toISOString(), exports,
    scope: "All accessible datasets and referenced assets; project settings, users, roles, tokens and external Clerk data are not included",
  });
  console.log(JSON.stringify({ directory, datasets: exports.length, complete: true }, null, 2));
}

async function main() {
  process.umask(0o077);
  const args = options(process.argv.slice(2));
  if (args.command === "--help" || args.command === "help") {
    console.log(`School migration tools (Node 22, --experimental-strip-types)
  backup --out /private/tmp/new-backup [--assets]
  plan --from /private/tmp/backup --out /private/tmp/new-plan [--org-map mapping.json] [--migration-id ID]
  reconcile --from /private/tmp/plan/plan.json
  apply --from /private/tmp/plan/plan.json --journal /private/tmp/new-journal --apply
  rollback --from /private/tmp/plan/plan.json --journal /private/tmp/new-rollback --apply
  export-project --out /private/tmp/new-project-export
Read-only commands use SANITY_READ_TOKEN; apply/rollback use SANITY_WRITE_TOKEN.
Optional SANITY_PROJECT_ID / SANITY_DATASET default to the current XtraPoint project.
Use node --env-file=.env to load local credentials without shell sourcing.`);
  } else if (args.command === "backup") await backup(args);
  else if (args.command === "plan") await plan(args);
  else if (["apply", "rollback", "reconcile"].includes(args.command)) await applyOrReconcile(args);
  else if (args.command === "export-project") await exportProject(args);
  else throw new Error("Unknown command; use --help");
}

main().catch((error) => { console.error(safeError(error)); process.exitCode = 1; });
