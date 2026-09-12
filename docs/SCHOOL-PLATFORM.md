# School management and the Resource Center

The application owns school preparation, invitations, draft editing and publication. Sanity remains the private storage adapter and the editorial CMS. Clerk remains the identity and membership provider. No additional hosted service was introduced.

## Sales to school ownership

1. Sign in at `/portal`, choose the XtraPoint staff administrator organization, and open `/admin/schools`.
2. Create the school during the sales call. Enter its name, short name, community/mascot, beneficiary and unique page address. New schools start private.
3. Edit its story and program details; open its Brand kit for logos and photography. Save the draft and inspect both page previews.
4. Create a seven-day private sales preview. It resolves the immutable school ID, stores only a hashed token, disables form submissions and replaces the previous preview link when regenerated.
5. For a retained draft-only record, select **Prepare retained school for access**. This preserves the draft and creates its application identity without making the pages public. Enable partner access, then invite the school's administrator.
6. An administrator approves the saved version and chooses the donor and/or ambassador page to publish. School administrators can subsequently publish their own organization's approved changes; editors save drafts and request review. Viewers have read access only.

The admin supports the default Clerk administrator and member/editor roles. Optional custom `org:editor`/`org:viewer` roles must exist in Clerk before assigning them. Staff must have a staff organization with `publicMetadata.staff=true` and the `org:admin` membership role to use global school administration. A shared preview secret never grants administration.

New invitations bind the Clerk organization to immutable `partnerId` plus the current compatibility slug. Existing slug-linked organizations remain supported; mismatched immutable IDs or stored organization IDs fail closed. All session mutations enforce same-origin requests and server-side role checks. No invitation was sent as part of implementation.

## Data and publication

- Existing records are adopted in place. Published/draft pairs, draft-only records, unknown fields, image references, approved snapshots, portal access and resource customizations are preserved.
- Draft saves and publication use revision checks. Publication atomically freezes the resolved content/media snapshot, updates page switches, creates history and audit records, and removes the promoted draft. Concurrent changes cause a conflict rather than overwriting another editor.
- The public donor, ambassador, QR and collateral routes render on demand. They use approved snapshots for managed schools in every environment; drafts use authorized or expiring preview routes. Pages and generated assets use short caches, so launching a school needs no global site build.
- Restoring a published version changes the public snapshot and preserves the working draft. Pausing removes the public school pages from the eligible source query.
- The existing Sanity staging rebuild webhook excludes managed-school writes while retaining its legal-page and legacy-school behavior. Corporate marketing remains static.
- Qualification stays fixed at three completed monthly donations in three consecutive months. Each distinct eligible, attributable supporter counts once. Partners select and fund rewards, approve their terms and operate their programs.

The verified migration retained **101 partners / 104 school documents**, one resource override, 238 asset records and 239 asset binaries. The user-approved Oregon Ducks address is `oregon-ducks`; University of Oregon remains `oregon`. The retained Missouri Southern record still contains a historical approval snapshot with an older slug. It was preserved and must be reviewed before that school's next publication. See [the migration runbook](SCHOOL-MIGRATION-RUNBOOK.md) for recovery and verification.

## Product navigation

The marketing portal and Ambassador Toolkit use the same XtraPoint-styled, neutral sidebar with a top product switcher. School logos and theme colors belong to school pages and collateral; the application navigation identifies the current school with text. The Marketing Portal's former Resource library is labeled Marketing materials.

The toolkit sidebar lists its six resources. Article topics expand inside the reading area, avoiding a second full sidebar. `/resources` redirects to `/resources/ambassador-toolkit` while the toolkit is the only shared guide collection. Main-site articles, search and downloads keep the existing private access gate; the navigation redesign does not make them public or add a public homepage link.

A successful signed-in school portal visit may remember only its validated canonical slug in per-tab session storage for the switcher's return link. This is a navigation preference, never authorization; the destination still rechecks access. Legacy bearer links are never persisted. The owner-private Sites edition uses an absolute link back to the main website's portal and does not depend on the main app's sign-in services during static export.

## Toolkit ownership and release workflow

The Resource Center is available at `/resources`, and the six-resource toolkit at `/resources/ambassador-toolkit`. The partner portal links to the same guidance. Anonymous access is disabled unless `XP_RESOURCE_CENTER_PUBLIC=true`; content, search and downloads share the gate. The separate existing Sites address remains owner-private.

The toolkit keeps its version 1.2 source content and six verified downloads. Its new web presentation adds searchable articles, a single topic sidebar, responsive layouts, joining/qualification diagrams, personalizable communications and participant-rule exports. Browser draft fields do not alter the standard Word, Excel, PowerPoint or PDF references.

Sanity contains six resource drafts, 145 article drafts and one prepared release. Article edits are staged editorial proposals. They do not independently change online text while leaving downloaded documents stale. Retained Wiki masters remain canonical until an explicit editorial cutover. Reconcile edits into those masters, regenerate affected formats, validate the full release, and deploy the matched publication. The release loader accepts only an approved complete snapshot whose content and six download hashes match the deployed release; otherwise it serves the verified bundle.

The GitHub repository is public. Private toolkit prose, source snapshots and binary downloads are ignored by Git. Build preparation restores their verified release artifacts from the existing private Sanity dataset using `SANITY_READ_TOKEN`. Do not commit the generated content or private backups to Git. Server tokens and private artifacts never enter anonymous static output.

For the private Sites edition, run `node scripts/export-toolkit-site.mjs /private/tmp/xp-toolkit-site` after generating/verifying the native publication, then follow the retained Sites hosting workflow. The export uses the same Astro resource components in a disposable static build; it does not weaken the main website's access gate. Preserve the existing `.openai/hosting.json`, project and private address. Old toolkit entry links lead into the new resource navigation.

## Rollout verification

Run `npm test`, `npm run build`, and the Studio build. These checks cover source/download parity, migration preservation and rollback, role boundaries, tenant separation, stale revisions, preview isolation and published-media snapshots. Use the existing Vercel branch preview before promoting to the existing staging branch; production remains a distinct code rollout. Verify the deployed signed-in experience with the correct Clerk instance before inviting schools. Corporate and school public pages must continue to work when no portal session is present.

The broader operational database can later replace the Sanity adapter behind these APIs. This implementation removes the immediate dependency on Studio and global builds for school management; it does not claim to replace XtraPoint's donor, attribution, payment or qualification-processing systems.
