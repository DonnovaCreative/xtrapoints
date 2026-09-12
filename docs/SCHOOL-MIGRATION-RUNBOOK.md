# School management migration and recovery

The first release changes who manages school records, not where they are stored. Existing Sanity `_type: "school"` records remain the source. Preserve each immutable document ID, every field, every unpublished draft, and every approved snapshot. No school is recreated, automatically merged, deleted, or republished by this migration.

## Identity and additive schema

The partner ID is the existing published document `_id`. For `drafts.<id>`, use `<id>` as the same partner ID. A school may have only a draft; it must still appear in the staff school inventory. Slugs are presentation/routing values and may collide in existing drafts, so staff record URLs and organization bindings must use the immutable ID.

The planner adds only these fields:

| Field | Type and behavior |
| --- | --- |
| `managementVersion` | Optional number. Set to `2` when opting into app management. Missing or `1` can migrate; unknown versions block the plan. |
| `clerkOrgId` | Optional string. Only add from a reviewed explicit `partnerId → org_…` mapping. Never derive access from a slug or replace a conflicting binding. |
| `managementMigratedAt` | Optional ISO datetime; set once on initial migration if absent. |
| `managementMigrationId` | Optional string; set once on initial migration if absent. |

These fields can be hidden/read-only in Studio. The app can introduce separate actor/update audit fields for subsequent actions. The migration never refreshes its original audit timestamp on reruns. Existing `portalEnabled`, legacy `portalToken`, preview tokens, `approvedVersion`, `approvedAt`, `productionStatus`, `livePages`, review fields, asset crops/credits, array `_key`s, and unknown fields are preserved verbatim. It neither creates a published copy for a draft-only school nor manufactures missing drafts.

Keep `templateOverride` documents and their current deterministic IDs intact. Their current identity is `schoolSlug` plus `templateId`, so slug changes need a separately reviewed override-routing migration. They are backed up but never patched by this migration. Content Release `versions.*` records are also retained in backups and reported, but are not automatically migrated.

## Tool and credentials

Run from the repository root with Node 22:

```sh
node --env-file=.env --experimental-strip-types scripts/school-migration.mjs --help
```

`--env-file` loads values without evaluating shell code. The scripts do not print tokens or raw records. Read operations require `SANITY_READ_TOKEN`; only `apply` and `rollback` require `SANITY_WRITE_TOKEN`. Optional `SANITY_PROJECT_ID` and `SANITY_DATASET` default to `xjhhxbqk` and `production`.

Place backups outside the repository. Backup directories are created with mode `0700`; files use `0600`. Backups contain private portal tokens, draft content, and other sensitive raw data. The tool refuses to overwrite existing backup/plan/journal directories. Retain a verified copy in the organization's existing durable, restricted backup storage; `/private/tmp` is a working copy and can be removed by the OS.

## 1. Inventory and backup before any write

```sh
node --env-file=.env --experimental-strip-types scripts/school-migration.mjs backup --out /private/tmp/xp-school-backup-NEW --assets
```

The read-only backup uses `perspective: "raw"`, keyset pagination, and no field projection. It captures **all** school and templateOverride records, including draft-only schools, separate published/draft values, orphan overrides, and release versions. It recursively finds image/file references, reads their complete asset records, and examines JSON snapshots for historical resolved CDN URLs. `--assets` downloads those binaries too, including assets used by an approved snapshot after current fields have changed.

The output contains:

- `records.json` and `records.ndjson`: complete raw school and override records.
- `asset-records.json`: full referenced asset documents.
- `asset-dependencies.json` and `assets/`: reference IDs, preserved CDN URLs, binary file paths, sizes and SHA-256 hashes.
- `inventory.json`: counts, per-record hashes/revisions and published/draft difference paths. It does not include private field values.
- `issues.json`: missing/duplicate records, invalid snapshots, orphan overrides and identity conflicts.
- `manifest.json`: source project/dataset, file sizes/hashes, source hash and completeness status.

A second full source read verifies that documents/assets did not change during backup. A changed source, missing asset record, or failed binary download means the backup is incomplete: inspect the private failure report and repeat into a new directory. Do not use an incomplete backup for migration. Two reads detect ordinary concurrent edits; use a maintenance window when strict point-in-time consistency is required.

The schema registry currently also contains `resourceTemplate`, `siteSettings`, `legalPage` and `supportPage`. Those shared/company content types are outside the school-only migration. For all accessible datasets plus their assets, the wrapper can run the locally installed official Sanity CLI:

```sh
node --env-file=.env --experimental-strip-types scripts/school-migration.mjs export-project --out /private/tmp/xp-project-export-NEW
```

The wrapper enumerates accessible datasets, writes one archive per dataset, and hashes each archive. CLI output is kept in private log files. It uses the current Studio's configured project (`xjhhxbqk`) and refuses a different project override. This needs an installed Studio CLI, sufficient token permissions and a writable CLI configuration directory. A failed dataset export does not produce a complete project manifest. An export of all datasets is a **content** backup: it does not export project roles, members, API tokens, webhook configuration, external Clerk users/memberships or all historical revisions. Use the existing account/configuration backup process for those systems.

## 2. Produce and review an offline plan

```sh
node --experimental-strip-types scripts/school-migration.mjs plan --from /private/tmp/xp-school-backup-NEW --out /private/tmp/xp-school-plan-NEW
```

Optional organization mapping JSON:

```json
{
  "existing-immutable-school-id": "org_ExistingOrganizationId"
}
```

Add `--org-map /private/tmp/reviewed-org-map.json` only after checking current Clerk organization metadata and memberships. Migration of Sanity bindings does not modify Clerk metadata or transfer membership. The existing slug association needs a separately tested compatibility path during cutover. An absent mapping leaves access fields unchanged.

The planner verifies every backup file hash, produces `plan.json`, and replays each additive patch in memory. The report contains before/after hashes and changed field paths; the backup still contains every original value. Existing binding conflicts, unknown partners, duplicate slugs, missing revisions and unsupported management versions block apply. Missing slugs, draft-only records, snapshot mismatch/corruption, or orphan overrides remain visible warnings and are never silently fixed or dropped.

Review all blockers before adopting records into app management. Correct records only through an explicit reviewed content change, then create a fresh backup/plan. Do not edit a backup to make a conflict disappear. Preserve the two Oregon records as distinct partner IDs; their approved slug resolution is recorded below.

## 3. Explicit apply, verification and retries

Only after the app release and specific plan are reviewed:

```sh
node --env-file=.env --experimental-strip-types scripts/school-migration.mjs apply --from /private/tmp/xp-school-plan-NEW/plan.json --journal /private/tmp/xp-school-apply-NEW --apply
```

The plan is recomputed from its verified backup. The configured project/dataset and full source hash must match the reviewed source, and each patch is guarded by the current document revision. All metadata patches commit in one transaction; plans over 500 changed records are rejected for separately reviewed batching. The tool adds no defaults to school content and never uses a replacement write. A repeated already-applied plan reports no changes.

Each attempt writes a private request journal before contacting the mutation API. A confirmed response is recorded with transaction ID. A timeout/network error is treated as uncertain, because a transaction can succeed before its response is lost. **Do not retry blindly.** Run the read-only comparison:

```sh
node --env-file=.env --experimental-strip-types scripts/school-migration.mjs reconcile --from /private/tmp/xp-school-plan-NEW/plan.json
```

Each changed record is classified `before`, `applied`, or `conflict`, comparing all original content plus the proposed metadata while ignoring only server `_rev`/`_updatedAt`. All `applied` means the metadata matches the plan. All `before` means it has not changed the content. A conflict needs inspection and a fresh plan or reviewed recovery. The read-only `reconcile` does not fix anything.

## 4. Targeted rollback and disaster recovery

For this metadata migration only:

```sh
node --env-file=.env --experimental-strip-types scripts/school-migration.mjs rollback --from /private/tmp/xp-school-plan-NEW/plan.json --journal /private/tmp/xp-school-rollback-NEW --apply
```

Rollback restores only the management fields changed by that plan: previous values are restored and newly added fields are removed. It guards each current revision, verifies that the record still matches the expected before/after content, and refuses a record edited beyond the migration. Already-original records are skipped. It does not replace raw documents, delete schools, reset access, undo later brand edits, restore an old live snapshot or delete assets. Run `reconcile` afterward; all changed records should be `before`.

For a larger data-loss incident, recover from the raw backup or full CLI export into a **new isolated dataset first**. Validate raw record counts, immutable IDs, approved snapshots, draft differences, override associations and asset hashes against the manifest before choosing a recovery cutover. Never run a blanket overwrite import against production to roll back this additive migration. Restore credentials and Clerk memberships through their own recovery procedures.

## Verified initial inventory — 12 September 2026

Read-only backup: `/private/tmp/xp-school-migration-backup-20260912-complete`.
Offline plan: `/private/tmp/xp-school-migration-plan-20260912/plan.json`.

| Preserved content | Count |
| --- | ---: |
| Distinct partner IDs | 101 |
| Published school documents | 18 |
| Draft school documents | 86 |
| Draft-only partners | 83 |
| Total raw school documents | 104 |
| Template override documents | 1 |
| Referenced asset documents | 238 |
| Downloaded asset binaries | 239 |
| Missing asset references | 0 |

The two-pass source check was stable. All binaries have hashes. No live records were mutated by this inventory or plan. The plan is intentionally blocked by one duplicate-slug conflict:

- `ad8f945d-97c0-4774-a182-1651b8a16639` (University of Oregon) and `school.oregon` (Oregon Ducks) are separate draft-only schools using `oregon`.
- `drafts.e63c4567-6a52-4bb6-ab9c-0a56b8269b3c` (Missouri Southern State University) has current slug `missouri-tigers-retired` and retained approved snapshot slug `missouri-tigers`. This is a warning; both values are preserved.

The 83 draft-only schools are a preservation requirement, not disposable drafts. An inventory filtered to published records would hide most partners.

### Approved slug correction and refreshed plan

The user explicitly directed that University of Oregon retain `oregon` and Oregon Ducks use `oregon-ducks`. After checking the current revision and destination uniqueness, only `drafts.school.oregon` → `slug.current` was changed to `oregon-ducks`. Verification found exactly one non-system difference, `/slug/current`; University of Oregon's complete record hash remained unchanged. The private before/after journal is `/private/tmp/xp-oregon-rename-journal-20260912`.

A new full raw backup with asset binaries is retained at `/private/tmp/xp-school-migration-backup-20260912-after-oregon`. The fresh plan is `/private/tmp/xp-school-migration-plan-20260912-after-oregon/plan.json`. Counts remain 101 partners, 104 school documents, one override, 238 asset documents and 239 binaries; zero missing references, stable two-pass reads, and **zero blocking errors**. The 83 draft-only notices and one approved/current slug mismatch remain informational warnings. The plan proposes only the three adoption metadata fields on all 104 school documents; no Clerk binding is inferred. Metadata apply is a separate reviewed step and was not run during the slug correction.

### Completed in-place adoption and editorial draft import

After the metadata plan was reviewed, the adoption transaction completed on 12 September 2026. All **104 school documents** reconciled as `applied`. A full before/after comparison of all 105 school/override records found no missing or added records and no unexpected content changes. Only `managementVersion`, `managementMigratedAt`, `managementMigrationId` and Sanity's system revision/update time changed on school documents. The template override, approved snapshots, production/page states, access fields, brand/content data, unknown fields and draft distinctions were preserved. No Clerk association was inferred or changed.

The original backup remains immutable. Durable, Git-ignored recovery copies are now retained locally:

- `.local-backups/schools/20260912-after-oregon`: complete post-rename, pre-adoption backup, including all 239 asset binaries. Every manifest file hash/size was rechecked after copying; directories are `0700`, files `0600`.
- `.local-backups/migrations/20260912-oregon-slug`: exact raw before/after records and proof of the approved slug-only correction.
- `.local-backups/migrations/20260912-school-management-v2`: reviewed plan, pre-request journal, confirmed transaction receipt, all-104 reconciliation report, raw post-adoption records, and full content-preservation verification.

The shared Toolkit CMS bridge was also reviewed and imported with `createIfNotExists`: **152 new draft documents** (six resource descriptors, 145 structured articles, one prepared release). A fresh live readback matched all 152 proposed documents exactly after excluding Sanity's system metadata. All six bundled download checksums passed verification. No toolkit document was published, no approved release was activated, and no asset was copied or uploaded. The prepared release pins the complete generated 1.2 article package and its six standard downloads; mutable editorial article changes are never read directly by public routes.

Private import and exact-readback reports are `.local-backups/migrations/20260912-toolkit-cms-import.json` and `.local-backups/migrations/20260912-toolkit-cms-readback.json`. Staff Studio schema/navigation deployment and the new application interface deployment are separate, pending rollout steps at the time of this data verification. Existing public school snapshots remain unchanged.

For editorial work, use the structured `xpToolkitArticle` canonical sections; derived message pages, Builder topics and combined participant rules regenerate from those sections. The retained Wiki masters remain authoritative until an explicit editorial cutover. To export a read-only candidate from Sanity drafts:

```sh
node --env-file=.env scripts/import-toolkit-cms.mjs --export-drafts /private/tmp/toolkit-editorial-candidate-NEW.json
```

The candidate is explicitly marked unverified. Reconcile its approved changes into the retained masters, regenerate affected standard files and the complete `content.json` publication, run `scripts/build-toolkit-content.mjs --check`, and then prepare/review a new immutable release revision. Publishing individual CMS articles cannot bypass that website/download consistency check. The import script defaults to read-only comparison and preserves existing drafts/published documents; it will not overwrite later editorial work.

## Validation

```sh
node --experimental-strip-types --test tests/school-migration*.test.ts
```

Tests cover unknown-field preservation, exact snapshot-string preservation, separate drafts, immutable identity, token-free reports, additive/idempotent mapping, conflicting organizations/slugs, revision/hash guards, historical asset discovery, corrupt backup rejection and refusal to overwrite reviewed files. Live apply, rollback and CLI full-project export are deliberately not exercised by these tests.
