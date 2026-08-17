// One-shot migration: `hiddenFromProduction` (boolean) → `productionStatus`
// (draft | review | live) plus an `approvedVersion` snapshot.
//
// Preserves what's live TODAY: a school that was on production (not hidden) is
// marked live and gets a snapshot of its current published content, so the first
// production build after this change serves exactly what it served before.
// Hidden schools become drafts.
//
// Needs the site running (local or deployed) to build snapshots through the same
// projection production reads:
//   SITE_ORIGIN=http://localhost:4321 PREVIEW_SECRET=… npx sanity exec \
//     scripts/zz-migrate-production-status.ts --with-user-token
//
// Safe to re-run: schools that already have a productionStatus are skipped.
// Delete this file once it's been run everywhere it needs to be.
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const { getCliClient } = require("sanity/cli");
const client = getCliClient({ apiVersion: "2024-01-01" });

// Load the site repo's .env (one level up from studio/) for PREVIEW_SECRET.
(function loadEnv() {
  const p = path.resolve(process.cwd(), "..", ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  }
})();

const ORIGIN = process.env.SITE_ORIGIN ?? "http://localhost:4321";
const SECRET = process.env.PREVIEW_SECRET ?? "";

async function run() {
  if (!SECRET) {
    console.error("PREVIEW_SECRET is not set (checked ../.env). Can't build snapshots.");
    process.exit(1);
  }

  const docs = await client.fetch<
    { _id: string; name: string; slug?: string; hidden?: boolean; status?: string }[]
  >(`*[_type == "school" && !(_id in path("drafts.**"))]{
    _id, name, "slug": slug.current,
    "hidden": hiddenFromProduction,
    "status": productionStatus
  }`);

  const pending = docs.filter((d) => !d.status);
  if (pending.length === 0) {
    console.log(`Nothing to migrate (${docs.length} school(s) already migrated).`);
    return;
  }

  for (const doc of pending) {
    const wasLive = doc.hidden !== true;
    if (!doc.slug) {
      console.log(`  ${doc.name}: no slug, → draft`);
      await client.patch(doc._id).set({ productionStatus: "draft" }).unset(["hiddenFromProduction"]).commit();
      continue;
    }

    if (!wasLive) {
      console.log(`  ${doc.name}: was hidden from production → draft`);
      await client.patch(doc._id).set({ productionStatus: "draft" }).unset(["hiddenFromProduction"]).commit();
      continue;
    }

    const res = await fetch(
      `${ORIGIN}/api/school-snapshot?school=${encodeURIComponent(doc.slug)}&secret=${encodeURIComponent(SECRET)}`,
    );
    const data = (await res.json()) as { snapshot?: string; error?: string };
    if (!res.ok || !data.snapshot) {
      console.log(`  ${doc.name}: snapshot failed (${data.error ?? res.status}) → draft`);
      await client.patch(doc._id).set({ productionStatus: "draft" }).unset(["hiddenFromProduction"]).commit();
      continue;
    }

    await client
      .patch(doc._id)
      .set({
        productionStatus: "live",
        approvedVersion: data.snapshot,
        approvedAt: new Date().toISOString(),
      })
      .unset(["hiddenFromProduction"])
      .commit();
    console.log(`  ${doc.name}: was on production → live (snapshot taken)`);
  }

  console.log(`Migrated ${pending.length} school(s).`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
