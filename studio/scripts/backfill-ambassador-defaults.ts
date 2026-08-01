// One-time migration: fill ambassadorTiers/ambassadorPrograms on school docs
// created before those fields existed, so editors see the standard
// Bronze/Silver/Gold tiers + recognition cards ready to tweak instead of a
// blank list. New schools no longer need this — the schema's `initialValue`
// (see schemas/school.ts) pre-fills them going forward.
//
//   cd studio && npm run backfill:ambassador-defaults
//
// Safe to re-run: uses setIfMissing, so it never overwrites a school that's
// already been customized (or already run once). Patches BOTH the published
// doc and its draft counterpart (if any) in one transaction, so the Studio
// form shows the defaults regardless of which version an editor is viewing —
// and so the staging-rebuild webhook (which fires per transaction) only fires
// once for this whole batch, not once per school.
import { getClient } from "./_lib.ts";
import {
  DEFAULT_AMBASSADOR_TIERS,
  DEFAULT_AMBASSADOR_PROGRAMS,
} from "../lib/ambassadorDefaults.ts";

async function run() {
  const client = getClient();
  const ids: string[] = await client.fetch(`*[_type == "school"]._id`);
  console.log(`Found ${ids.length} school document(s) (published + drafts).`);
  if (!ids.length) return;

  const tx = client.transaction();
  for (const id of ids) {
    tx.patch(id, (p: any) =>
      p.setIfMissing({
        ambassadorTiers: DEFAULT_AMBASSADOR_TIERS,
        ambassadorPrograms: DEFAULT_AMBASSADOR_PROGRAMS,
      }),
    );
  }
  await tx.commit();
  console.log(
    `Done — backfilled default tiers/programs (only where missing) on ${ids.length} document(s).`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
