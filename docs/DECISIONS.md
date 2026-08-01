# Decisions

Short log of non-obvious engineering decisions. Newest first.

---

## 2026-08-01 — Incident: "Promote to production" looked broken; `main` was just stale code

**Context:** Client reported unpublishing a school (Example State) in Sanity
"worked on both staging and production" per their read, but production kept
showing old content — the "Promote to production" button appeared to do
nothing. Investigation (diffing the actual served HTML) found production's
meta description still had wording (", free") that was removed by the very
first "held pending sign-off" copy-pass commit — i.e. **production was running
code from before this whole feature set existed.** `main` had not been merged
forward since before this project's promote-tool/hide-from-production/
ambassador-tiers/photo-credit work started; it was still 5 commits behind
`staging` (`git log main..staging --oneline` showed all of them).

**Root cause:** "Promote to production" only ever rebuilds whatever **code**
is on `main`, against **current Sanity content**. It is a content-promotion
tool, not a code-deploy tool. Since `main` never got the code that adds (a)
the `hiddenFromProduction` GROQ filter, (b) the ambassador tier/program CMS
fields, and (c) photo credits, none of it could possibly work on production —
promoting just produced a fresh build of the old code, which looked identical
to "not working."

**Fix:** Fast-forwarded `main` to `staging` (`git merge --ff-only staging`)
and pushed — this itself triggers a production rebuild via Vercel's git
integration (independent of any Sanity webhook), bringing the code current.
Verified via the served meta description losing the old ", free" wording.
Confirmed with the client before merging, since 3 of those 5 commits were the
previously-held copy-pass work — merging is all-or-nothing (fast-forward), not
cherry-pickable, so holding one commit while shipping another isn't a normal
option without a more involved rebase.

**Takeaway / gotcha for later:** the promote tool's UI and the docs now say
explicitly that it's content-only — check `git log main..staging --oneline`
before trusting a promote to reflect a recent code change. See the added
warning in HANDOFF.md's "Where things stand" section.

---

## 2026-07-31 (follow-up) — "Hide from production" toggle, and pre-filled Ambassador defaults

**Context:** Client feedback on the same-day promote-tool work (above): (1)
clicking Sanity's native **Unpublish** only visibly affects staging (it
auto-rebuilds); production is a static build that only changes when someone
clicks "Promote to production," so an unpublished school appeared to "still be
live" until that next promote — the client wanted an explicit way to pull a
school off production specifically. (2) The new `ambassadorTiers`/
`ambassadorPrograms` fields shipped empty on every existing school, so
customizing one tier meant retyping the whole default structure from scratch.

**Decision (production visibility):** Added `hiddenFromProduction` (boolean,
new "Publishing" group) to `school`. `schoolsSource.ts`'s `VALID` GROQ filter
excludes `hiddenFromProduction == true` docs **only when `VERCEL_ENV ===
"production"`** (`isProduction` from `site-env.ts`) — staging/preview/local
builds ignore the flag entirely. This gives three independent lifecycle
actions matching what the client asked for: **Unpublish** (native Sanity
action — removes it everywhere, staging immediately, production on the next
promote), **Hide from production** (stays published/visible on staging,
excluded from production only, on the next promote), and **Promote to
production** now explicitly documented (in its own UI copy) as the mechanism
that also carries removals live, not just additions.

**Decision (pre-filled defaults):** `ambassadorTiers`/`ambassadorPrograms` get
`initialValue: DEFAULT_AMBASSADOR_TIERS/PROGRAMS` (new `studio/lib/
ambassadorDefaults.ts`, shared with `scripts/_lib.ts`'s `writeSchool` so
ESPN-seeded and bulk-imported schools are pre-filled too) — covers schools
created **going forward**. For the ~80 school documents (5 published, 75
drafts — mostly test/scratch content from earlier ESPN-seed experiments)
already in the dataset, ran a one-time migration
(`scripts/backfill-ambassador-defaults.ts`, `npm run
backfill:ambassador-defaults`) that `setIfMissing`-patches every existing
school (published + draft) in a **single transaction** — verified against
`westminster`'s published doc before/after. `setIfMissing` means re-running it
is always safe and never clobbers a school that's since customized these
fields.

**Non-obvious gotchas:**
- Sanity's array `initialValue` only applies when a document is created
  through the Studio's own "Create new" form — it does **not** retroactively
  backfill existing docs (hence the separate migration script) and does
  **not** apply to docs created via the CLI/API (`seed-college.ts`,
  `import.ts`) unless those code paths set the fields themselves — done here
  by injecting the defaults in the shared `writeSchool` helper.
- A single transaction batching many patches fires the "Rebuild staging"
  webhook **once** (per transaction), not once per document — important given
  the existing Vercel deploy-rate-limit gotcha (HANDOFF.md) when touching many
  schools at once.
- Object-type array members (the tier/program objects) need `_key` (+ `_type`
  matching the array member's schema `name`) for the Studio's array editor;
  the plain-string `perks` array does not.

---

## 2026-07-31 — Photo credits: nested `credit` field on each image, not a parallel object

**Context:** Schools want to credit the photographer for game-day photos used on
their pages (`school.photos.team/celebrate/fans/action/mascot`).

**Decision:** Add an optional `credit` string field **nested inside each image
field** (`fields: [CREDIT_FIELD]` in `studio/schemas/school.ts`), not a separate
top-level "credits" object in the Studio. In GROQ it's pulled as a sibling
projection (`"photoCredits": { team: photos.team.credit, ... }`) and merged back
onto `school.photos.credits.<key>` in `schoolsSource.ts` — so `school.photos.team`
stays a plain URL string (no template call-site changes) while
`school.photos.credits?.team` carries the caption. A new `PhotoCredit.astro`
component renders a small bottom-right corner caption ("Photo: X") and is dropped
into every place a `photos.*` image renders (both hero backgrounds, both
`SchoolPhotoBand` usages, the dynamic "why give" photo, and the ambassador
callout). No credit set → nothing renders, byte-identical to before.

**Why:** Keeping `photos.<key>` as a string (rather than promoting it to
`{url, credit}`) avoided touching every existing call site
(`school.photos.team`, `<SchoolPhotoBand src={...}>`, etc.) across
`SchoolLanding.astro` / `SchoolAmbassadors.astro`. The credit lives with the
image in the Studio (natural editing UX — you set it right where you upload the
photo) without forcing a breaking type change everywhere the URL is consumed.

---

## 2026-07-31 — Ambassador tiers/programs moved from hardcoded arrays to optional CMS arrays

**Context:** The Ambassador page's three-tier incentive structure (Bronze/Silver/
Gold + perks) and the recognition cards ("Ambassador of the Month", "Seasonal
campaigns", etc.) were hardcoded in `SchoolAmbassadors.astro`. Each school will
want to set its own incentives per tier.

**Decision:** Two optional array fields on `school` (group "Ambassador
program"): `ambassadorTiers` (`name`, `role`, `perks[]`, `highlight`) and
`ambassadorPrograms` (`title`, `body`). Both are **flexible arrays, not fixed
3/4-slot objects** — a school can add, remove, or reorder tiers/cards, not just
edit copy within a locked structure. The old hardcoded arrays become
`DEFAULT_TIERS` / `DEFAULT_PROGRAMS` constants in `SchoolAmbassadors.astro`;
the template uses the CMS arrays only when non-empty
(`school.ambassadorTiers?.length ? school.ambassadorTiers : DEFAULT_TIERS`).

**Why:** Matches the project's established "zero required per-school authoring"
pattern (see the 2026-07-08 naming-model decision below) — every school that
doesn't touch these fields renders exactly the prior copy. Flexible-length
arrays cost nothing extra over fixed slots and avoid a future re-migration if a
school wants a 2- or 4-tier structure instead of 3.

---

## 2026-07-31 — Independent staging/production publishing: drop the auto-webhook, add a manual promote button

**Context:** One Sanity dataset feeds both `staging.xtrapoint.com` and
`xtrapoint.com` — there was never a content-level split between the two, only
two Sanity webhooks ("Rebuild staging", "Rebuild production") listening to the
identical publish event (`school`/`legalPage`, drafts excluded) and firing two
different Vercel Deploy Hooks. Every publish therefore went live on production
immediately, with no review window — the client wanted staging and production
publishing decoupled.

**Decision:** Deleted the "Rebuild production" Sanity webhook (id
`vneMqIKAZLwK6nEk`) via `sanity hook delete`. "Rebuild staging" is untouched, so
publishing still auto-rebuilds staging instantly. Added a **"Promote to
production" Studio tool** (`studio/promoteTool.tsx`, registered as a top-level
Studio tool, not a per-document action — it promotes *all* currently published
content, not one doc) that POSTs directly to the same production Vercel Deploy
Hook the webhook used to call, bypassing Sanity's webhook layer entirely. An
editor reviews content on staging, then clicks Promote when it's ready to go
live.

**Alternatives considered:**
- *Two Sanity datasets (staging + production) with a copy/sync step* — true
  content-level independence (staging content could differ from prod content,
  not just timing), but a much bigger lift: doubled asset storage, a dataset
  switcher in the Studio, promote/export tooling, and re-plumbing every GROQ
  query to pick a dataset per environment. Rejected as disproportionate — the
  ask was about *when* content goes live, not needing genuinely different
  content per environment.
- *Manual curl/Vercel-dashboard promote, no Studio button* — same webhook
  change, zero new code, but every promotion needs a developer. Rejected in
  favor of a button so the client's non-technical editors stay self-serve,
  matching the existing pattern of client-facing Studio actions (draft preview,
  ESPN auto-fill).

**Non-obvious gotchas:**
- The Sanity management API rejects `PATCH .../hooks/.../{id} {isDisabled:true}`
  from a CLI user token ("A service session is required to set `isDisabled`") —
  disabling via that route needs a browser session. `sanity hook delete` (the
  supported CLI/user-token flow) works fine and was used instead; the Vercel
  Deploy Hook itself is untouched, so nothing needs to change on Vercel's side.
- The promote button's URL is bundled into the (publicly served) Studio JS via
  `SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL` — same obscurity-level posture
  already accepted for `SANITY_STUDIO_PREVIEW_SECRET`. Anyone with it can
  trigger a production *rebuild*, not read/write content.

---

## 2026-07-08 — School copy: scalable naming model + optional custom blocks

**Context:** Client/school feedback (SHSU/KatFund) wanted per-school phrasing —
"give through KatFund", "Become a KatFund Ambassador", "approved by KatFund",
"support Bearkat Athletes" — plus an optional custom "why give" pitch and an
explainer video. The constraint: this templates to hundreds of schools, so it
must default cleanly with **zero required per-school authoring**.

**Decision:** Two optional naming fields + resolved helpers in `schoolsSource`
(`naming()`), never hand-written per school:
- `fundShort` (e.g. "KatFund") → drives `programName` (else school `short`),
  `approver` (else `fund`), and the giving destination.
- `beneficiary` (e.g. "Bearkat Athletes") → defaults to `the <mascot>`.
- `givingDest` = `"<beneficiary> through <collective>"` when `fundShort` is set,
  else `"the <fund>"` (the exact prior default). Templates use `{givingDest}`
  **bare** (no leading "the") so both branches read grammatically.
- Optional `whyGiveHeading`/`whyGiveBody` replace the default value-prop cards
  in the "Why round up" section only when the body is set (Bucket A rewrote the
  default to be donor-focused, so the fallback is strong).
- Optional `videoUrl` (per-school) with a single `DEFAULT_EXPLAINER_VIDEO`
  constant for the one XP-branded video — never per-school custom video.

**Why:** pushes the scalability the client asked us to protect — every new field
is optional with a sensible default, so the ~hundreds of other schools need no
input, while KatFund-style partners get their exact copy. Verified: a school with
none of these set renders byte-for-byte as before.

**Gotcha:** `beneficiary` is a ready-to-drop-in phrase (default carries its own
"the"), so templates must NOT prefix it with "the" — otherwise "the Bearkat
Athletes" for schools that set a proper-noun beneficiary.

---

## 2026-07-07 — Studio "Auto-fill from ESPN" via a site endpoint + client-side upload

**Context:** Non-technical editors wanted the terminal `seed:college` flow (pull a
college's mascot/colors/logo from ESPN) available in the Studio when creating a
new school.

**Decision:** A **school document action** ("Auto-fill from ESPN") that calls a
**secret-gated site endpoint** `src/pages/api/seed-college.ts` (`prerender=false`,
shared logic in `src/lib/collegeSeed.ts`). The endpoint does the ESPN + College
Scorecard lookups **server-side** (keeps `DATAGOV_API_KEY` off the client, avoids
browser CORS on those APIs) and proxies the logo bytes as base64. The action then
`setIfMissing`-prefills the open draft and **uploads the logo under the editor's
own Sanity session** — so no server-side write token is needed.

**Why these choices:**
- **`setIfMissing`, not `set`** — "prefill" must never clobber what the editor
  already typed. On a fresh draft everything fills; on a partially-filled one only
  the blanks do.
- **Client-side logo upload** (from proxied base64) instead of the endpoint
  writing to Sanity — avoids introducing a server write token; writes stay under
  the authenticated operator. The base64 hop sidesteps a CORS-blocked image fetch.
- **Gated by `PREVIEW_SECRET`** and reuses the Studio's `SANITY_STUDIO_PREVIEW_*`
  env (origin + secret) — no new Studio config.
- **Draft-only, unverified** — colors are approximate, logo is a preview, ink is a
  placeholder; the action says so. Colleges only (ESPN has no K-12).

**Gotcha:** `DATAGOV_API_KEY` is local-only today, so the hosted flow fills
mascot/colors/logo but not city/state/official name until the key is added to
Vercel. The endpoint degrades gracefully (uses ESPN's short name).

---

## 2026-07-07 — Support = own doc type; "Legal & Compliance" Studio group

**Context:** A client compliance package (round-up donation platform) implied
several policy/support pages should be manageable on xtrapoint.com as the
canonical legal home. `/support` had shipped as a static page. First pass folded
it into the `legalPage` type — the user pushed back: Support should keep its own
design and not sit inside "Legal pages."

**Decision:**
- **Support gets its own singleton doc type `supportPage`** with a bespoke layout
  (structured `email`/`hours`/`address` → contact card; `body` rich text for the
  sections, reusing `renderLegalBody`). `src/pages/support.astro` stays a normal
  route reading the singleton. This keeps the original design while making the
  copy CMS-editable. (Rejected: `legalPage` for support — lost the contact card,
  mislabeled it "Legal," and dumped it in the legal cross-nav.)
- **Refund Policy + Cookie Policy are `legalPage`s** (they *are* legal docs) —
  Refund a published starting point, Cookie a permanent **draft** until tracking
  exists. Seeded via `seed-legal-extra.ts`; the Portable Text builder was
  extracted to `studio/scripts/_pt.ts` (shared with `seed-legal.ts`).
- **One Studio group "Legal & Compliance"** (structure in `sanity.config.ts`)
  holding Legal Documents (`legalPage`, renamed from "Legal pages"), Customer
  Support (`supportPage`), and School page legal copy (`siteSettings`) — so the
  client's team manages all of it in one place.

**Non-obvious gotchas:**
- **`supportPage` is NOT in the Sanity→Vercel rebuild webhook** (school +
  legalPage only), so publishing it doesn't deploy — the page updates on the next
  build. Intentional, but note it when editing support copy.
- **Contact card + injected body share one CSS section counter.** The template
  `<h2 id="contact">` (section 01) and the `set:html` body H2s (02+) both live in
  `.support-body`, so the counter selectors are written for both scoped
  (`.support-body h2`) and global (`.support-body :global(h2)`).
- **Studio access ≠ nav grouping.** Grouping only organizes the desk; letting the
  client's team edit means inviting them to the Sanity project. Restricting them
  to *only* the legal group needs custom roles (RBAC, a paid Sanity plan).

---

## 2026-07-03 — Draft preview for school pages (on-demand SSR, not a rebuild)

**Context:** Editors wanted a Contentful-style "see it before publishing." The
site is `output: 'static'`, so published content is baked at build time and drafts
render nowhere.

**Decision (Option A — preview URL + Studio button, no visual-editing overlays):**
- Extract the donor page body into `SchoolLanding.astro` (shared, prop-driven).
  The static route renders it from published data; a new **on-demand** route
  `src/pages/preview/schools/[slug].astro` (`prerender = false`) renders the *same*
  component from the **draft** (`getSchoolDraft` → a `previewClient` with the
  `previewDrafts` perspective). Same component = preview matches production exactly.
- A Studio document action (`previewAction.ts`) opens the preview URL for the
  current doc.

**Why not the full Presentation tool (Option B):** visual editing needs a viewer
token, stega-encoded content, and the visual-editing overlay integration — much
heavier. Option A delivers the core "preview before publish" now; B can layer on
later inside the same route.

**Non-obvious gotchas / decisions:**
- **⚠ On-demand SSR routes must render browser-oriented islands as `client:only`.**
  The preview route 500'd on Vercel (only there — not locally, not in the static
  build) because it server-rendered `DotField` (three.js) and `ContactForm`
  (`@hcaptcha/react-hcaptcha`). three.js/meshline aren't traced into the function
  bundle, and @hcaptcha ships ESM that the Lambda `require()`s as CJS ("Cannot use
  import statement outside a module"). Static pages dodge both because they render
  at **build time**; the runtime function doesn't. Fix: both islands are
  `client:only` in `SchoolLanding`, so Astro never imports them on the server.
  **Rule for future SSR/on-demand routes: any client island they render must be
  `client:only`.** (`vite.ssr.noExternal` for @hcaptcha was tried and did not
  reliably fix it — `client:only` is the robust fix.)
- **Debugging note:** this only reproduces in Vercel's serverless runtime. To get
  the real stack when logs aren't accessible, the route temporarily surfaced errors
  in the (secret-gated) response body; the defensive try/catch around the data
  fetch was kept.
- **Refactor safety:** extracting `SchoolLanding` was verified byte-identical
  against the pre-refactor built HTML for a sample school before shipping.
- **Secret gating is obscurity-level.** The Studio is a public client bundle, so
  any `SANITY_STUDIO_*` secret it holds is extractable. Acceptable for draft school
  pages (client logos + generic copy); the route still 401s without the secret and
  sends `noindex`. Upgrade path: `@sanity/preview-url-secret` (per-click,
  dataset-verified) for true gating — needed before previewing anything sensitive.
- **Three env vars must share one value:** site `PREVIEW_SECRET` (Vercel + .env)
  and Studio `SANITY_STUDIO_PREVIEW_SECRET`. Studio origin points at staging for
  pre-publish review.
- Preview routes are excluded from the sitemap (astro.config filter) alongside the
  one-pagers.

---

## 2026-07-03 — Fixed overlay header: custom config-driven shell, not shadcn

**Context:** The header was `position: relative` with a solid navy bar on every
page — too bold on white pages (legal docs), and it needed to scale as the site
grows (blog, products, solutions, guides).

**Decision:** A custom Astro shell shared by `Header.astro` and
`SchoolHeader.astro`: fixed overlay, **transparent at the top** (the hero's own
background shows through), glass morph (blur + tint) once scrolled, and smart
hide-on-scroll-down / reveal-on-scroll-up. States (`data-scrolled` / `data-hidden`
/ `data-open`) are set by one shared script (`src/scripts/header-behavior.ts`);
each component styles them. `variant="dark|light"` picks logo + text colors
(light = navy logo for white pages). **Links are config-driven**
(`src/config/nav.ts`); an item with `children` renders a CSS-only dropdown
(hover/focus-within) with zero component changes.

**Why not shadcn NavigationMenu:** everything needed here is *shell* behavior
(fixed/transparent/morph/hide) that NavigationMenu doesn't provide — it's only the
dropdown widget — and it would hydrate a React island on every page for what is
currently links + a CTA (against the site's islands-only-for-real-interactivity
rule, see CtaButton). If a rich mega-menu is ever needed, embed NavigationMenu as
one island *inside* this shell; nothing else changes.

**Non-obvious gotchas:**
- **Every page's first section must offset itself** by the header height:
  `pt-[calc(var(--header-h)+<original-pt>)]` (`--header-h` in globals `:root`).
  A new top-level page that forgets this will tuck its hero under the header.
- **School theming survives `position: fixed`** — CSS custom properties inherit
  through fixed positioning, so the scrolled glass (`color-mix` on
  `var(--color-ink)`) picks up the school's ink from the themed wrapper.
- **`html { scroll-behavior: smooth }` affects programmatic checks** — a
  `window.scrollTo()` animates, so state assertions mid-animation lie. Use
  `behavior: 'instant'` when testing.
- The header never hides while the mobile menu is open or focus is inside it
  (keyboard users must not lose the bar mid-tab).

---

## 2026-07-03 — Legal pages (Terms / Privacy): CMS rich text + one dynamic route

**Context:** The footers linked Terms/Privacy out to `lpt.io`. XtraPoint needs its
own pages, built from LaCore's legal copy, editable by non-engineers, with a
Stripe-guides-style sticky table of contents and cross-links between the pages.

**Decision:**
- **One Sanity doc type `legalPage`** (title, slug, `navLabel`, `lastUpdated`,
  `body` as Portable Text) + **one dynamic root route** `src/pages/[legal].astro`
  driven by `getStaticPaths()`. Adding a legal doc in the Studio (e.g. a Cookie
  Policy) makes its page + the cross-page quick-links appear with **no code
  change** — the slug *is* the URL (`terms` → `/terms`).
- **Body is rich text (Portable Text)**, rendered to HTML at build with
  `@portabletext/to-html`. The sticky **TOC is derived from the H2/H3 headings**,
  not authored separately.
- **Scrollspy is plain inline JS** (rAF-throttled scroll → "last heading past the
  top line" + smooth anchor scroll), matching the site's no-island, progressive-
  enhancement pattern — no React.
- **Design is editorial/quiet (à la stripe.com/legal), not the athletic hero.**
  No colored hero; light page, Space Mono eyebrow + Inter title, a numbered section
  outline shared between the sidebar and the body H2s (CSS `counter`), cross-doc
  links live in the sidebar (mobile: in the header) — deliberately restrained, with
  lime used only as an accent. Inter (not Anton) for the title is intentional: legal
  copy is a calmer register than the marketing pages.
- Content seeded via `studio/scripts/seed-legal.ts` (`npm run seed:legal`), the
  same `sanity exec --with-user-token` pattern as the school scripts.

**Non-obvious gotchas:**
- **Heading ids must match between the TOC and the rendered headings.**
  `renderLegalBody()` (src/data/legal.ts) does a single coordinated pass: it
  assigns deduped slug ids keyed by each block's `_key`, builds the TOC from them,
  then the `to-html` heading serializer looks the id back up by `_key`. Don't
  slugify twice independently — dedup counters would drift.
- **Scoped `<style>` doesn't reach `set:html` content.** The Portable Text HTML is
  injected via `set:html`, so prose rules target it as `.legal-body :global(...)`
  (the `.legal-body` wrapper carries the scope; `:global()` matches its injected
  descendants).
- **Exclude drafts in GROQ.** The build authenticates with `SANITY_READ_TOKEN`, so
  queries return `drafts.*` docs (created whenever an editor opens a doc in the
  Studio) alongside the published version → the page rendered a doc twice. Fixed
  with `!(_id in path("drafts.**"))` in `legalSource.ts`. ⚠ `schoolsSource.ts` has
  the same latent bug — apply the same guard there.
- **Entity framing:** XtraPoint is a **DBA of LaCore Payments Technologies, Inc.**
  (as is "LPT"). The seed keeps LaCore as the binding legal entity and uses
  "XtraPoint" as the operating/defined term. **This is seed content — legal review
  happens in the Studio.** Contact email left as `support@lacorepayments.com` (the
  operating entity's real inbox) and the Melissa, TX address kept; confirm both.

**Alternatives considered:**
- *Two hand-written `.astro` pages with hard-coded copy* — rejected; not editable
  by the client and duplicates layout.
- *A React island for the TOC* — unnecessary; the site is islands-only for genuine
  interactivity and this is a scroll listener.

---

## 2026-07-02 — Co-branded sales one-pager: HTML page + headless-Chromium PDF

**Context:** Each school needs a branded sales sell-sheet (see the Oregon
reference). Doing these by hand per school doesn't scale.

**Decision:** Make the one-pager a **third re-skinned template**
(`/schools/<slug>/one-pager`) reading the same Sanity data as the landing pages,
and generate the PDF on demand by printing that page with **headless Chromium**
(`/schools/<slug>/one-pager.pdf`, `puppeteer-core` + `@sparticuz/chromium`),
CDN-cached like the OG image. A new school gets its sell-sheet for free.

**Alternatives considered:**
- *Rebuild the layout in satori/@react-pdf* (the OG stack) — rejected; can't
  cleanly reproduce a full marketing page (mesh gradient, watermark, phone), and
  it'd mean maintaining the design twice.
- *Hosted HTML→PDF API* — viable fallback, avoids bundling Chromium, but adds an
  external dependency + per-render cost. Chose self-hosted Chromium (no new SaaS).

Built 1:1 from the Figma source (file `W4w45f3JV7E4AFSiFSymdO`, node `1:118`):
authored in Figma's native **612×792** coordinate space and scaled (×1.3334) to
fill the 8.5×11in sheet, so px values map straight from Figma. Type is
**Inter Display** (self-hosted in `/public/fonts`, from rsms/inter) + **Space Mono**
— NOT the site's Anton/Inter stack. The XtraPoint mark is the gradient-white
lockup (`/public/assets/xtrapoint-logo-gradient-white.svg`).

**Non-obvious gotchas:**
- **Color mapping (per the Figma):** **primary** = eyebrows / checks / editorial
  accent / phone header; **secondary** = the CTA button + chevron bullets + hero
  gradient end + progress bar; **darken(primary, .68)** = the dark-green role
  (hero-left gradient, phone "add card", footer). The hero **watermark** is the
  school's full-color **avatar**. Single-color schools still work — secondary
  falls back to a primary tint (a paler CTA, but readable).
- **`libnss3.so` on Vercel:** `@sparticuz/chromium` only extracts its bundled
  glibc libs + sets `LD_LIBRARY_PATH` when it detects Lambda via `AWS_EXECUTION_ENV`
  / `AWS_LAMBDA_JS_RUNTIME`. Vercel doesn't set those, so Chromium failed with
  `libnss3.so: cannot open shared object file`. Fix: set
  `process.env.AWS_LAMBDA_JS_RUNTIME ||= "nodejs20.x"` **before** importing the
  package (its detection runs at module-eval time) to opt into the AL2023 lib set.

**Caveat:** the PDF function fetches its own `/one-pager` page over HTTP, so
enabling Vercel **Deployment Protection** on preview/staging would break PDF
generation there (production unaffected).

---

## 2026-07-01 — Per-environment search de-indexing (staging/preview only)

**Context:** One static build/config deployed to both production and staging, so
`staging.xtrapoint.com` was publicly crawlable/indexable (`robots.txt` = `Allow: /`,
no noindex).

**Decision:** De-index every non-production deploy while leaving production
untouched, via three layers:
- `robots.txt` (dynamic endpoint) and `<meta name="robots">` keyed on
  `VERCEL_ENV` at **build time** (`src/config/site-env.ts`).
- `X-Robots-Tag` header via `vercel.json`, keyed on **hostname** (staging +
  `*.vercel.app`), because a static build's `vercel.json` is shared across
  environments and can't read `VERCEL_ENV` per-request.

**Guard (critical):** `shouldNoindex = Boolean(VERCEL_ENV) && VERCEL_ENV !== "production"`
— an **allowlist** on the single value that must remain indexable. A missing or
unexpected env value fails **open** (indexable), so production can never be
accidentally noindexed. The header rules never list production hosts.

**Alternatives considered:**
- *Denylist by hardcoded staging host only* — misses `*.vercel.app` previews.
- *SSR middleware to set headers per-request* — rejected; site is `output:'static'`,
  not worth adding a server runtime for this.
- *Noindex when `VERCEL_ENV !== 'production'` without the `Boolean()` guard* —
  would noindex on a missing env var, risking production. Rejected.

**Follow-up:** Enable Vercel **Deployment Protection** (password/SSO) on
staging/preview — a dashboard toggle and the stronger fix for public access.

See [deploys-and-indexing.md](deploys-and-indexing.md).

---

## 2026-07-01 — Production ships from `main`; promote via merge

**Context:** `/schools/*` rendered on staging but 404'd on `www.xtrapoint.com`.
Root cause: the school pages existed only on the `staging` branch; production
builds from `main`, and Astro generates those routes from `getStaticPaths()` at
build time — so the production build never produced them.

**Decision:** Treat `main` as the production source of truth. New routes reach
production only when merged to `main` (which triggers the Vercel production
deploy). Not an env/config issue — purely unmerged code.
