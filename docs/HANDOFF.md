# Session handoff — XtraPoint marketing site

Pick-up notes for continuing in a fresh chat. Start a new chat **in this project**
and say: _"Read docs/HANDOFF.md and docs/DECISIONS.md, then confirm the git state
(`git log main..staging --oneline`) before we start."_

> Reference docs: [README.md](../README.md) (run/build, brand toggle, contact form),
> [ADDING-A-SCHOOL.md](ADDING-A-SCHOOL.md) (the co-branded school pages + the 3
> onboarding paths), [COMMANDS.md](COMMANDS.md) (everyday terminal commands),
> [deploys-and-indexing.md](deploys-and-indexing.md) (envs + SEO),
> [DECISIONS.md](DECISIONS.md) (why). This file is **current state**.

_Last updated: 2026-08-17._

---

## Where things stand (git / deploy)

- **⚠ `staging` is 4 commits AHEAD of `main`** (as of 2026-08-17) — the whole
  Marketing Portal (accounts, brand editing, per-school promotion) is on staging
  and **not yet on production**. That's deliberate; see "Marketing Portal" below
  for what the production cutover needs.
  - **Production** = `xtrapoint.com` (apex → `www`), builds from **`main`**.
  - **Staging** = `staging.xtrapoint.com`, builds from the **`staging`** branch.
- **Promotion flow**: `git checkout main && git merge --ff-only staging && git push origin main`
  (then `git checkout staging`). Keep them in sync.
- **⚠ "Promote to production" (the Studio tool) is CONTENT-only — it does NOT
  deploy code.** It reruns a production build using whatever code is *already*
  on `main`, with current Sanity content. If `main` is behind `staging` (code
  changes only ever land on `staging` first — see COMMANDS.md), clicking it
  will NOT bring those code changes to production, no matter how many times
  you click it — you'll just get a fresh build of the *old* code. This bit us
  once already: `main` sat 5 commits behind `staging` for a while (including a
  copy pass from before this promote/hide-from-production/ambassador-tiers
  work existed), so production kept serving stale copy and none of the new CMS
  fields worked there, even though "Promote to production" appeared to run
  fine. **Check `git log main..staging --oneline` before assuming a promote
  will show what you expect** — if it lists anything, merge `staging` → `main`
  (above) first, *then* promote (or just push to `main`, which triggers its
  own production build via Vercel's git integration — no separate promote
  needed after a code merge).
- **Deploy gotcha:** a Vercel build occasionally gets **stuck/superseded** and
  doesn't publish. If prod doesn't update after ~a few minutes (earlier deploys
  were ~80s), re-trigger with an empty commit (`git commit --allow-empty`) or the
  next Sanity publish. It clears.
- **Deploy rate limit:** pushing many commits in a short window can hit a Vercel
  **deployment rate limit** (builds queue/pause). It resets on a rolling window
  (minutes–hour); a single empty commit re-triggers once it clears. Don't spam
  commits — that makes it worse.

## Stack / how to run

Astro 6 (static + on-demand islands) + React islands + Tailwind v4 + shadcn/ui +
Framer Motion + GSAP + Three.js/R3F (homepage lanyard). Deploy: Vercel.

```sh
npm install
npm run dev      # http://localhost:4321  (needs SANITY_READ_TOKEN in .env — see below)
npm run build    # static build — source of truth for "is it broken"
```

## Architecture worth knowing

- **Brand toggle** — `src/config/brand.ts`. `PLURAL` switch → name/domain/emails/logo.
  Currently `false` → "XtraPoint" / xtrapoint.com.
- **Design tokens** — `src/styles/globals.css` `@theme`. Brand lime `#aaf10a`, ink
  `#03116d`, `--color-accent-2` (secondary), fonts Anton / Permanent Marker /
  Space Mono / Inter. `.ed` editorial accent word; `.glow`, `.dot-grid`,
  `.playbook-mark` (X/O marks, accept a `color` prop).
- **Site header (fixed overlay)** — `Header.astro` + `SchoolHeader.astro` share a
  shell: `fixed`, transparent at top (the hero bg shows through), glass morph on
  scroll, hides on scroll-down / reveals on scroll-up
  (`src/scripts/header-behavior.ts` drives `data-scrolled`/`data-hidden`/`data-open`).
  `Header` takes `variant="dark|light"` — **light** (navy logo, white glass) is for
  solid-white pages like the legal docs; school pages map `whiteHeader` → light.
  **Nav links live in `src/config/nav.ts`** — items with `children` render a
  CSS-only dropdown automatically (that's the scale path for blog/products/guides;
  a shadcn NavigationMenu island only if a rich mega-menu is ever needed).
  ⚠ The header overlays content: every page's **first section** must offset with
  `pt-[calc(var(--header-h)+…)]` (`--header-h` in globals.css `:root`).

## 🎓 Co-branded school pages — now fully CMS-driven (READ ADDING-A-SCHOOL.md)

Two pages per school (`/schools/[slug]` donor + `/schools/[slug]/ambassadors`) +
an auto OG image, all re-skinned to the school. **Content lives in Sanity**, not
the repo.

- **Sanity project** `xjhhxbqk`, dataset `production` (⚠ **private** — anonymous
  doc reads are denied, so a **read token is required**). Studio hosted at
  **https://xtrapoint.sanity.studio**.
- **`SANITY_READ_TOKEN`** (Viewer) must be set in **Vercel (Production + Preview)**
  AND local **`.env`**. Server-side only (build + the OG function); never shipped
  to the browser. Client: `src/config/sanity.ts` (`useCdn:false`).
- **Data layer** — `src/data/schoolsSource.ts`: `getSchools()` / `getSchool()` /
  `getSiteSettings()` query Sanity via GROQ and map to the `School` type.
  `src/data/schools.ts` is now **types + theme helpers only** (no data array).
  Templates + the OG endpoint read *only* through the data layer.
- **Studio code** lives in **`studio/`** (own package.json, React 18, Sanity v3;
  isolated from the Astro build). Schema: `studio/schemas/school.ts` +
  `siteSettings.ts` (a singleton for footer legal copy). Custom inputs in
  `studio/components/`: **ColorInput** (hex string + swatch + Clear) and
  **FundInput** (Generate "<Mascot> Athletics Fund"). Deploy the Studio after
  schema changes: `cd studio && npx sanity deploy` (studioHost pinned).
- **Theme / colors** — editors set `primary` + `ink` (+ optional `secondary`,
  `onAccent`, `primaryDarkOverride`), stored as **hex strings**. `deriveSchoolTheme`
  (schools.ts) computes deep/dark/soft + resolves `secondary` (a real 2nd color,
  else a lighter tint of primary for single-color depth). Empty primary/ink →
  XtraPoint brand defaults. Secondary drives the **atmospheric layer** (glows,
  DotField gradient, X/O marks, hero pill/eyebrow); primary keeps buttons/links/
  editorial. Vars incl. `--color-accent-2` via `schoolThemeVars`.
- **Components** (`src/components/school/`): `SchoolHeader` (school logo only —
  no XP lockup; `whiteHeader` toggle for a white bar; `logoSize` sm/md/lg/xl),
  `SchoolPhone` (app mockup; masks the `mark` via a build-time data-URI),
  `SchoolPhotoBand` (spirit band), `SchoolFooter` (black; CMS `legalCopy`).
  Photos degrade to solid color when unset; the ambassador callout falls back to
  `/images/ambassador-default.png`.
- **Photo credits** — each `photos.*` image field has an optional nested
  `credit` string (Studio: set it right on the image). Surfaced via
  `school.photos.credits?.<key>` (`schoolsSource.ts` `mapPhotos`) and rendered
  by a shared `src/components/PhotoCredit.astro` (small bottom-right corner
  caption, "Photo: X") dropped into every `photos.*` usage — both hero
  backgrounds, both `SchoolPhotoBand` calls, the dynamic "why give" photo, and
  the ambassador callout. No credit set → renders nothing. See DECISIONS.md
  2026-07-31.
- **Ambassador page tiers/programs** — the three-tier incentive structure
  (Bronze/Silver/Gold + perks) and the recognition cards ("Ambassador of the
  Month", "Seasonal campaigns", etc.) are optional CMS arrays,
  `school.ambassadorTiers` (`name`/`role`/`perks[]`/`highlight`) and
  `school.ambassadorPrograms` (`title`/`body`), group "Ambassador program" in
  the Studio. Flexible length — a school can add/remove/reorder, not just edit
  copy in fixed slots. Empty → `DEFAULT_TIERS`/`DEFAULT_PROGRAMS` in
  `SchoolAmbassadors.astro` (the original hardcoded copy). **Pre-filled** with
  those same defaults for every school — `initialValue` in `school.ts` for new
  Studio-created docs (shared constants in `studio/lib/ambassadorDefaults.ts`,
  also wired into `scripts/_lib.ts`'s `writeSchool` for ESPN-seed/bulk-import),
  plus a one-time backfill (`npm run backfill:ambassador-defaults`, safe to
  re-run) for schools that predate the fields. Editors tweak/delete individual
  entries rather than typing from scratch. See DECISIONS.md 2026-07-31.
- **OG images** — on-demand: `src/pages/schools/[school]/og.png.ts`
  (`prerender = false`) + `src/og/renderSchoolOg.ts` (satori + `@resvg/resvg-js`;
  fonts in `src/og/fonts/` bundled via `includeFiles` in `astro.config.mjs`;
  fetches the school logo from the Sanity CDN). CDN-cached, generated once.
- **Sales one-pager (PDF)** — a third re-skinned template per school, one US-Letter
  sheet, built **1:1 from Figma** (file `W4w45f3JV7E4AFSiFSymdO`, node `1:118`).
  `src/pages/schools/[school]/one-pager.astro` = HTML source of truth (static,
  `noindex`, sitemap-excluded via `astro.config.mjs`). It's authored in Figma's
  native **612×792** coordinate space inside a `transform: scale()` canvas that
  fills the 8.5×11in sheet, so px values map straight from Figma. Static copy;
  re-skins via `schoolThemeVars` + theme/logo/avatar data.
  `one-pager.pdf.ts` (`prerender = false`) prints it via **headless Chromium**
  (`puppeteer-core` + `@sparticuz/chromium` on Vercel; local Chrome in dev, override
  `CHROME_PATH`), CDN-cached like the OG. `maxDuration: 60` on the Vercel adapter;
  traced binary in the `_render.func` bundle (~110MB < 250MB limit). **Live in prod.**
  - **Type:** self-hosted **Inter Display** (`/public/fonts`, from rsms/inter) +
    Space Mono — *not* the site's Anton stack.
  - **Color roles (per Figma):** **secondary** (yellow) = CTA button + chevron
    bullets + hero-gradient end + progress bar; **primary** (green) = eyebrows /
    checks / editorial accent / phone header; **`darken(primary,.68)`** = the
    dark-green sections (hero-left, phone "add card", footer). Hero **watermark =
    the full-color `avatar`**. Single-color schools still work (secondary →
    primary tint). XP mark = `xtrapoint-logo-solid-white.svg`.
  - **⚠ PDF export = keep everything OPAQUE.** Chromium exports *fade-to-transparent
    gradients* and *element `opacity`* as PDF **soft-masks**, which some viewers
    (Preview/Quartz, PDFium) silently DROP. So: hero is a single **opaque** gradient
    (no transparent stops); XP mark is the **solid-white** logo (not the alpha-stop
    gradient one, whose glyph vanished); the dot texture is **inline vector
    `<circle>`s** (a CSS-gradient/`<img>` dot pattern rasterizes → blurs) stepped
    down with **`fill-opacity`** (= *constant alpha*, which is safe + crisp, unlike
    element opacity). **Verify PDFs via macOS Quartz** — `sips -s format png x.pdf
    --out x.png` — NOT just poppler (`pdftoppm`); poppler renders soft-masks fine
    and hides the bug.
  - **⚠ Vercel Chromium `libnss3` fix:** Vercel doesn't set the AWS env vars
    `@sparticuz/chromium` sniffs to detect Lambda, so it skips extracting its glibc
    libs → `libnss3.so: cannot open shared object file`. Fixed by
    `process.env.AWS_LAMBDA_JS_RUNTIME ||= "nodejs20.x"` **before** importing it
    (its detection runs at import time). See `one-pager.pdf.ts`.
  - **⚠ Deployment Protection:** the PDF fn fetches its own `/one-pager` over HTTP,
    so enabling Vercel Deployment Protection on preview/staging breaks PDF gen
    *there* (production unaffected).
  - Layout is tuned to fit exactly one page (CTA footer flush at the bottom) —
    re-check the fit if you change copy.

- **Ambassador flyer (PDF)** — the student-facing recruitment sheet, and the
  second **generated** portal resource. Same machinery as the one-pager:
  `src/pages/schools/[school]/ambassador-flyer.astro` is the HTML source of truth,
  `.pdf.ts` / `.png.ts` print it. Ported from a **Claude Design** artboard
  (`Ambassador Flyer.dc.html`), which is authored directly in **inches** at 8.5×11
  — so unlike the one-pager there's no scaled coordinate canvas; the values in
  `AmbassadorFlyerView.astro` are the design's own.
  - **Type:** self-hosted **Archivo** variable (`/public/fonts/Archivo*.woff2`,
    converted from Google's TTFs). The display setting is `'wdth' 62` condensed
    italic — a static fallback reflows the headline, so the variable axes matter.
  - **Nothing is authored per school.** Colors resolve through
    `src/lib/flyerTheme.ts` and copy through `src/lib/flyerContent.ts`, both
    derived from the existing school record — a new school gets a flyer with no
    one writing one. The reward chips do pick up `ambassadorTiers[].perks` when a
    school has customised them.
  - **⚠ The color resolver is not decoration — read its header before touching
    it.** The design assumes a dark primary + light secondary (UAlbany purple +
    gold). Most schools aren't that shape, so `base`/`accent`/`mark` are chosen by
    measured WCAG contrast, including a **7:1 preference on `base`** (a mid-tone
    primary passes 4.5:1 but leaves no room for a light accent above it) and a
    separate **`mark`** role for the accent-colored bits that sit on the bare
    white sheet (bullets, CTA button) rather than on `base`. Both rules exist
    because their absence produced real broken sheets — a grayscale flyer for an
    orange school, and an invisible white-on-white pillars band for a red one.
  - **⚠ The hero photo and its scrim MUST stay separate elements, and the photo
    MUST be cropped server-side** (`croppedImage` in `src/lib/sanityImage.ts`).
    Chromium flattens any image under a semi-transparent overlay into a bitmap at
    the **source** dimensions — an uncropped hero put the PDF at **6MB**; cropping
    to the band's own 3.26:1 at ~1200px brings it to ~1.4MB with no visible
    difference under a 78–94% scrim.
  - Unlike the one-pager, the flyer's glyphs export as **Type3** fonts (a
    variable-font quirk of Chromium's PDF writer). They're vector and cost almost
    nothing — a photo-less flyer is 344KB — but the text isn't selectable. Checked
    against macOS Quartz per the soft-mask warning above; the scrim survives.
  - Cutouts (`photos.cutout` / `cutoutSecondary`) are **pre-masked transparent
    PNGs**, deliberately a separate field from `photos.mascot` — a mascot on a
    white box prints as a white box. Absent → the headline widens into the space.

- **Adding another generated template** — register it in
  `src/lib/generatedTemplates.ts` AND in `GENERATED_TEMPLATE_IDS` in
  `studio/schemas/resourceTemplate.ts` (the Studio can't import from the site), then
  create the Marketing Resource document with a `generated` format pointing at the
  id. `src/lib/printSheet.ts` (was `onePagerPdf.ts`) does the Chromium rendering for
  all of them — pass the sheet's selector and, if it isn't US-Letter, its size.

- **Hero rays** — the donor + ambassador heroes layer React Bits **SideRays**
  (`src/components/islands/SideRays.tsx`, WebGL via **`ogl`**, `client:only`)
  *under* the DotField dots — soft animated light rays from the top-right corner.
  `rayColor1` = primary, `rayColor2` = **secondary if set, else primary**
  (`theme.hasSecondary`). Like all WebGL islands it's `client:only` so the preview
  SSR functions don't choke on it. (Replaced an earlier Silk shader that read too
  strong.) Intensity/saturation/origin are the tuning knobs in the two heroes.

### Adding schools — 3 paths (detail in ADDING-A-SCHOOL.md)

1. **Studio form** — https://xtrapoint.sanity.studio (non-technical). Colleges:
   the ⋯ menu has **"Auto-fill from ESPN"** (`studio/collegeAutofillAction.tsx`) →
   opens a dialog to search + pick a college (@sanity/ui), calls the site endpoint
   **`/api/seed-college`**
   (`src/pages/api/seed-college.ts` + `src/lib/collegeSeed.ts`), and
   `setIfMissing`-prefills the open draft (mascot/colors/fund/logo; city/state +
   official name only if `DATAGOV_API_KEY` is on Vercel). Logo is uploaded under
   the editor's own session (no server write token). Endpoint is gated by
   `PREVIEW_SECRET`; the action reuses the Studio's `SANITY_STUDIO_PREVIEW_*` vars.
2. **Bulk import** — `cd studio && IMPORT_FILE=import/x.json npm run import`
   (`PUBLISH=1` for live; else drafts). `studio/scripts/import.ts`.
3. **Auto-seed a college (terminal)** — `cd studio && SEARCH="oregon" npm run seed:college`
   to find ESPN's name, then `COLLEGE="Oregon Ducks" npm run seed:college` →
   review-ready draft (mascot/color/logo-preview from ESPN; optional city/state +
   official name from College Scorecard if `DATAGOV_API_KEY` is in `.env`).
   `studio/scripts/seed-college.ts`. All run via `sanity exec --with-user-token`
   (operator's login — no separate write token).

### Publish → staging; Approve → production (PER SCHOOL)

**This changed on 2026-08-17. Anything you read elsewhere about a global
"Promote to production" button or a "Hide from production" toggle is stale.**

- **Publishing** a school triggers the Sanity webhook → Vercel Deploy Hook and
  rebuilds **staging only**. It never touches `xtrapoint.com`.
- **Production is per-school.** Each school has `productionStatus` (`draft` |
  `live`) on its Publishing tab. Only `live` schools appear on production, and
  they render their **`approvedVersion`** — a JSON snapshot of the resolved GROQ
  projection taken when someone clicked **Approve for production**
  (`studio/components/ProductionStatusInput.tsx` → `/api/school-snapshot`).
- **This is why editing a live school is safe.** Their changes go to staging for
  review while production keeps serving the approved snapshot. The Publishing tab
  shows *"Live — changes not approved"* when the two have diverged.
- The sidebar tool is now **"Deploy production"** — plumbing only, for changes not
  tied to one school (site settings, legal pages, resource library). Approving a
  school already fires the deploy hook.
- **Removals:** Unpublish as usual, then **Deploy production** to carry it live.
- **Consequence worth knowing:** the snapshot is taken *after* the projection, so
  a new schema field does not reach production until each school is approved
  again. `toSchool` is null-tolerant so old snapshots don't break, but a schema
  rollout needs a re-approve pass.

## 🔐 Marketing Portal — the partner dashboard (NEWEST WORK, staging only)

A private per-school dashboard at `/portal/…`: their live pages, co-branded
one-pager, the shared resource library, and a **brand editor** they can use
themselves. Built on shadcn's `sidebar-07`, re-skinned to each school's colors.

**Two ways in, one gate** (`src/lib/portalRoute.ts` — read this first):
- `/portal/<32-hex-token>` — Stage 0 links, still working, no account
- `/portal/<school-slug>` — a signed-in Clerk user whose org maps to that school

The same page files serve both. `gatePortal` also owns the noindex /
no-referrer headers, so a new portal page can't ship without them.

**Accounts (Clerk).** One Organization = one school, linked by the org's
`publicMetadata.schoolSlug` (backend-writable only, so it can't be self-granted).
Onboarding is entirely in the Studio: the school's **Marketing portal** tab
invites people by email (`/api/portal-access`), and **creates the org on the
first invite**. `scripts/clerk-orgs.mjs` survives only for the staff flag
(`--staff`), an org that can open every school's portal.

**Middleware is scoped** (`src/middleware.ts`) to `/portal`, the auth pages and
`/api/portal-brand`. With `output: 'static'`, Astro middleware also runs at BUILD
time — an unguarded `clerkMiddleware` would put auth in front of the whole
marketing site.

**Brand editing.** Schools change their logo, avatar, colors and the five photos
(with credits). Everything writes to the Sanity **draft**, so the existing Studio
review flow is the approval gate. The security boundary is an **allowlist**
(`src/lib/portalEdit.ts`) — never a blocklist, so a sensitive field added later
can't silently become editable. Schools cannot reach `productionStatus`,
`approvedVersion`, `portalEnabled`, `portalToken`, their slug, or any page copy.

**What Stage 2 still needs — see "Open items" for the full list.**

## 📄 Legal & Compliance (legal docs + support + school legal copy)

All the legal / compliance / support content is grouped in the Studio under one
**Legal & Compliance** folder (structure in `studio/sanity.config.ts`) so the
client's team can manage it in one place:

- **Legal Documents** — the `legalPage` list (was "Legal pages").
- **Customer Support** — the `supportPage` singleton.

Site-wide settings live in a separate top-level **Site settings** entry (the
`siteSettings` singleton): the **Default explainer video** (shown on every school
page unless a school sets its own `videoUrl`) + the **school-page footer legal
copy**. (It moved out of the Legal & Compliance group once it held more than legal
copy.)

### Legal Documents (`legalPage`) — `/terms`, `/privacy-policy`, `/refund-policy`, `/cookie-policy`

- **One doc type** `legalPage`: title, slug (= the URL), short `navLabel`,
  `lastUpdated`, **Portable Text `body`**. One **dynamic route**
  `src/pages/[legal].astro` renders all of them — add a doc, get a page +
  cross-links, no code. Slug is the URL (`terms` → `/terms`).
- **Editing:** edit the `body` rich text; H2/H3 become the sticky **TOC**
  automatically. Publishing rebuilds the site (webhook covers `legalPage`).
- **Data layer** — `src/data/legalSource.ts` (`getLegalPages()`/`getLegalPage()`),
  `src/data/legal.ts` (`renderLegalBody()` → `{html, toc}`; **coordinated
  heading-id pass** so TOC anchors match). Drafts excluded from the live build.
- **Seed:** Terms/Privacy via `npm run seed:legal`; Refund + Cookie via
  `npm run seed:legal-extra` (`studio/scripts/`; `PUBLISH=1` to go live). The
  Portable Text builder is shared in `studio/scripts/_pt.ts`.
- **Refund Policy** (`/refund-policy`) + **Cookie Policy** (`/cookie-policy`) are
  seeded **starting points** for counsel. Cookie stays a **draft** (no tracking
  yet → off the live site until published). The Support page links to the Refund
  Policy, so **publish Refund when Support goes to prod** or that link 404s.
- **⚠ Content is seeded, not legally reviewed** — see Open item #10. See also the
  client's compliance checklist mapping (Open item #11).

### Customer Support (`supportPage`) — `/support`

- **Own doc type + bespoke layout** (NOT the shared legal template): structured
  `email` / `hours` / `address` fields render the **contact card**; `body` rich
  text renders the numbered sections below it (reuses `renderLegalBody`; contact
  card is section 01). Route: `src/pages/support.astro`. Footer-linked only.
- **Data layer** — `src/data/supportSource.ts` (`getSupportPage()` singleton).
- **Seed:** `npm run seed:support` (`PUBLISH=1` to go live).
- **⚠ Not in the rebuild webhook** — publishing `supportPage` does NOT auto-deploy;
  the page updates on the next site build (or trigger one).

## 👁 Draft preview (school pages) — secret-gated, on-demand

Editors can preview a school's **unpublished draft** on the real page before
publishing (Option A — no visual-editing overlays yet).

- **Studio:** ⋯ menu on a doc → eye-icon actions. **School** docs get three:
  *Open preview* (donor) + *Preview ambassador page* + *Preview one-pager (PDF)*;
  **legal** + **support** docs get one each. Via `studio/previewAction.ts` (a
  `makePreviewAction` factory) + `document.actions` in `sanity.config.ts`. Icon
  from `@sanity/icons@^3` (React-18 compatible — v5 needs React 19).
- **Routes** (`prerender = false`; shared secret gate `src/lib/previewGuard.ts`):
  - `preview/schools/[slug]` → `SchoolLanding.astro` (donor)
  - `preview/schools/[slug]/ambassadors` → `SchoolAmbassadors.astro`
  - `preview/schools/[slug]/one-pager` → `OnePagerView.astro` (draft sell sheet;
    its Download button → the draft PDF below)
  - `preview/schools/[slug]/one-pager.pdf` → prints the secret-gated draft HTML
    preview via headless Chromium (shared `src/lib/printSheet.ts`, used by the
    published PDF too). So sales can download a sell sheet **before** publishing.
    Not CDN-cached (drafts change). ⚠ Deployment Protection would break it (the fn
    fetches its own preview URL — see DECISIONS).
  - `preview/legal/[slug]` → `LegalPageView.astro`; `preview/support` → `SupportPageView.astro`
  Each renders the **same component** as the live route, from the **draft**
  (`getSchoolDraft()` / `getLegalPageDraft()` / `getSupportPageDraft()` — a
  `previewClient` with the `previewDrafts` perspective). So preview == production fidelity.
- **⚠ Extracted shared components** back the static + preview routes:
  `SchoolLanding`, `SchoolAmbassadors`, `OnePagerView`, `LegalPageView`,
  `SupportPageView`. Edit the page there. The donor/ambassador islands (DotField,
  ContactForm, WaitlistForm) are **`client:only`** so the on-demand SSR function
  never server-renders browser-only deps (three.js, @hcaptcha) — see the DECISIONS
  gotcha. (The one-pager has no islands, so it server-renders directly.)
- **Gating:** requires `?secret=<PREVIEW_SECRET>` or it 401s; also sends
  `X-Robots-Tag: noindex`. **Security is obscurity-level** — the Studio bundles the
  secret (see note in `previewAction.ts`); fine for draft school pages, upgrade to
  `@sanity/preview-url-secret` for true per-click gating.
- **Env (all three must share the same secret):** site `PREVIEW_SECRET` (`.env` +
  **Vercel Production + Preview**) · Studio `SANITY_STUDIO_PREVIEW_SECRET` +
  `SANITY_STUDIO_PREVIEW_ORIGIN` (`studio/.env`, baked in at `sanity deploy`).
  Origin currently points at **staging** for pre-publish review; repoint to prod
  if desired.
- Preview covers **donor, ambassador, and legal** pages.

## Forms (Web3Forms) — unchanged

All forms post to Web3Forms (`PUBLIC_WEB3FORMS_KEY` in `.env` + Vercel) →
`sales@xtrapoint.com`. hCaptcha on the full ContactForm; honeypot on WaitlistForm.

## Environments & SEO — unchanged (see deploys-and-indexing.md)

Staging/preview de-indexed, production indexable (keyed on `VERCEL_ENV`).

## Env vars summary

| Var | Where | Purpose |
| --- | --- | --- |
| `SANITY_READ_TOKEN` | Vercel Prod+Preview **and** local `.env` | Read school content at build + OG runtime (required) |
| `PREVIEW_SECRET` | Vercel Prod+Preview **and** local `.env` | Gates the draft-preview route; must match Studio's `SANITY_STUDIO_PREVIEW_SECRET` |
| `DATAGOV_API_KEY` | local `.env`; **add to Vercel** to enable it in the Studio "Auto-fill from ESPN" flow (optional) | Auto-seed city/state + official name via College Scorecard |
| `PUBLIC_WEB3FORMS_KEY` | `.env` + Vercel | Contact/waitlist form delivery |
| `PUBLIC_CLERK_PUBLISHABLE_KEY` | `.env` + Vercel **Preview+Prod** | Portal auth. `PUBLIC_` ⇒ inlined at BUILD time, so adding it needs a redeploy |
| `CLERK_SECRET_KEY` | `.env` + Vercel **Preview+Prod** | Portal auth, server-side |
| `SANITY_WRITE_TOKEN` | `.env` + Vercel | Brand editor writes (Editor perms on `production` dataset). **Not yet set on Vercel — brand editing 503s on staging until it is.** |
| `PUBLIC_STAGING_ORIGIN` | optional | Where the portal points schools for page previews. Defaults to `https://staging.xtrapoint.com` |

## Open items / follow-ups

### Marketing Portal (current work — do these first)

- **A. `SANITY_WRITE_TOKEN` is not on Vercel.** Brand editing returns a clean 503
  on staging until it's added (Preview + Production). It IS set locally.
- **A2. The ambassador flyer has no Marketing Resource document yet.** The
  template, routes and registry entries are all in (`ambassador-flyer`), and every
  school renders — but until someone creates the resource document in the Studio
  it isn't in any school's library. Create it under **Marketing Resources** with a
  format of source *generated* → *Ambassador recruitment flyer (PDF)*; the title,
  description, category and "How to use it" copy are the only decisions.
  Meanwhile it's reachable directly at `/schools/<slug>/ambassador-flyer`.
- **A3. No school has a mascot cutout uploaded.** Every flyer currently renders
  the no-cutout variant (headline widened, no mascot bleeding off the hero). The
  fields exist in the Studio and in the portal's brand editor; they need
  pre-masked transparent PNGs. UAlbany's are in the Claude Design export.
- **B. Production cutover, not started.** Needs, in order: merge `staging` →
  `main`; create the **Clerk production instance** (DNS CNAMEs on the domain +
  your OWN Google OAuth credentials — the dev instance uses Clerk's shared app,
  which production forbids); add `pk_live_`/`sk_live_` to Vercel Production;
  **recreate the orgs there** (dev and production Clerk instances share NO users
  or orgs); point `SANITY_STUDIO_PREVIEW_ORIGIN` at production and redeploy the
  Studio. Every account made in the dev instance is throwaway.
- **C. Wider school editing (the actual Stage 2 ask).** The client wants schools
  to also edit page copy, ambassador tiers/incentives, and "key details" — the
  brand editor was deliberately scoped to brand-only first. Extend
  `EDITABLE_*` in `src/lib/portalEdit.ts` plus the editor UI; the draft/review
  plumbing already works and shouldn't need changing.
- **D. Legacy portal tokens still live.** Both doors work during transition.
  Lackawanna and Sam Houston currently have tokens. Revoke per school once their
  people have signed in.
- **E. Two one-shot migration scripts left in `studio/scripts/`**
  (`zz-migrate-resources.ts`, `zz-migrate-production-status.ts`). Both have been
  run against `production`. Delete once you're confident.
- **F. Studio panels not verified by Claude.** The Sanity Studio's *document
  forms* don't render in Claude's in-app browser (its realtime WebSocket is
  blocked — list views work fine). So the invite panel, the Approve button and
  the status badges were built and their APIs tested directly, but a human needs
  to eyeball the actual Studio UI.

### Older

1. **Test schools left live** — `oregon`, `boise-state`, `example-state`,
   `kennesaw-state`, `butler` are published with **preview/placeholder data +
   unverified (ESPN) logos** (trademark exposure; indexable). User chose to leave
   them; revisit (finish or unpublish). Real partners: **sam-houston, westminster**.
2. **Real partners are single-color** — set a `secondary` on sam-houston /
   westminster (both have an official navy) to use the two-tone treatment.
3. **Spirit-band copy is hardcoded** — the donor page's band says "Eat 'em up,
   Kats" (Sam-Houston-specific). Make it per-school or generic.
4. **Vercel deploy title** — content-publish deploys show the branch HEAD commit
   (inherent to Deploy Hooks; not fixed).
5. **Ambassador waitlist inbox** — route to a dedicated Web3Forms key (not done).
6. **Vercel Deployment Protection** on staging/preview (dashboard toggle).
7. Homepage §06 stock photos (Pexels) still to replace. _(Footer Terms/Privacy
   now point to the internal `/terms` + `/privacy-policy` pages — see below.)_
10. **Legal pages content is seeded, not lawyered.** `/terms` + `/privacy-policy`
    are live from Sanity, but the copy is LaCore's LPT text auto-adjusted (XtraPoint
    as a DBA of LaCore Payments Technologies, Inc.). **Have counsel review it in the
    Studio.** Specifically confirm: the contact email (`support@lacorepayments.com`,
    the operating entity's inbox) and the Melissa, TX mailing address.
8. **One-pager top-right lockup** renders `school.logo` in its natural color on the
   light/yellow hero (the `brightness(0)` filter was removed per design). A school
   whose only logo asset is **white/mono** (fine for the dark landing header) will
   look faint/invisible there — such schools need a dark or full-color logo variant.
9. **One-pager watermark + dots use `fill-opacity`/image opacity** (constant alpha,
   verified in Quartz). If a future viewer drops them, swap to a fully-opaque
   technique (see the "keep everything OPAQUE" note above).

## Dev gotchas

- **Restart dev + clear cache after CSS `@theme` / island changes:**
  `rm -rf node_modules/.vite .astro`. Production build is source of truth.
- **Studio must be redeployed** (`cd studio && npx sanity deploy`) for schema
  changes to show in the hosted editor; **hard-refresh** the Studio (SPA cache).
- **`sanity exec` quirks** (scripts): load CJS like `sanity/cli` via
  `createRequire`; wrap in `run().catch()` (no top-level await); can't import the
  site's `.ts` from outside `studio/` (inline data).
- **Brand colors are hex strings** now (not the color-input plugin); a stray
  non-string is ignored by `deriveSchoolTheme` (falls back to brand default).
- zsh: `#` isn't a comment interactively — strip trailing `# notes` from pasted
  commands.
