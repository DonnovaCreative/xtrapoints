# Native Ambassador Toolkit publication

This directory is a generated publication adapter for the retained XtraPoint Wiki toolkit. The release is **1.2, 2026-09-11**. Individual input editions retain their own version: rules 1.1 and catalog 1.0 are members of the 1.2 release, not obsolete records to silently relabel.

`masters/` contains verbatim retained master snapshots, plus the verified release manifest. These are provenance snapshots, not a second editable CMS. Edit the retained Wiki source, rebuild affected standard downloads, and reimport that complete release together:

```sh
node scripts/build-toolkit-content.mjs --source-dir '/path/to/_source' --library-dir '/path/to/library'
node scripts/build-toolkit-content.mjs --check
```

`content.json` is the rendering/search contract. It retains source resource and article/message IDs, source hashes, download checksums, release details, full guidance, all 60 incentive records, 23 message templates and kickoff facilitator notes. Program Builder guidance derives directly from the guide; its verified XLSX remains the working calculator. No browser calculator makes different financial assumptions.

`sanity-export.ndjson` is a proposed migration contract with stable `xpToolkitResource` and `xpToolkitArticle` document IDs and references. It has **not** been imported. Adopt and validate matching Sanity schemas before any import. The retained masters are authoritative until an explicit, reconciled editorial cutover. Raw block source fields remain alongside normalized rendering types.

`downloads/*.json` packages exact current files as server-only base64 imports. This avoids placing private planning materials under public static paths or requiring deployment-specific filesystem bundling. Downloads run through the same authorization gate as HTML and the search index. For larger libraries, replace this small-release packaging with authenticated object storage URLs, keeping hashes and the gate intact.

Routes are server-rendered under `/resources`. Anonymous production access is disabled unless `XP_RESOURCE_CENTER_PUBLIC=true`. Local development, authorized XtraPoint staff and authenticated members of an enabled mapped partner may access the library. Middleware must initialize Clerk for `/resources` when protected. Do not link this route in anonymous navigation before rollout.

Template personalizations remain in memory until navigation. Only the five optional shared program fields can be explicitly remembered on the device; recipient details and complete drafts are never stored. Copies, HTML exports and browser printouts are drafts until the partner completes and reviews them. Standard DOCX/XLSX/PPTX/PDF files are unchanged unfilled references. No sends, publication, donor tracking, qualification processing or participant consent occur in this UI.
