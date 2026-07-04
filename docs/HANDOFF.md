# Session handoff — XtraPoint marketing site

Pick-up notes for continuing in a fresh chat. Start a new chat **in this project**
and say: _"Read docs/HANDOFF.md and README.md, then let's continue."_

> Reference docs: [README.md](../README.md) (run/build, brand toggle, contact form),
> [ADDING-A-SCHOOL.md](ADDING-A-SCHOOL.md) (the co-branded school pages + the 3
> onboarding paths), [COMMANDS.md](COMMANDS.md) (everyday terminal commands),
> [deploys-and-indexing.md](deploys-and-indexing.md) (envs + SEO),
> [DECISIONS.md](DECISIONS.md) (why). This file is **current state**.

_Last updated: 2026-07-03._

---

## Where things stand (git / deploy)

- **`main` and `staging` are in sync** and both **live**:
  - **Production** = `xtrapoint.com` (apex → `www`), builds from **`main`**.
  - **Staging** = `staging.xtrapoint.com`, builds from the **`staging`** branch.
- **Promotion flow**: `git checkout main && git merge --ff-only staging && git push origin main`
  (then `git checkout staging`). Keep them in sync.
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

- **Hero shader** — the donor + ambassador heroes layer a React Bits **Silk**
  shader (`src/components/islands/Silk.tsx`, `client:only`) *under* the DotField
  dots, `mix-blend-screen` at ~50% opacity, tinted to the school's **secondary if
  set, else primary** (`theme.hasSecondary`). Vendored (deps already present:
  three + @react-three/fiber); like all WebGL islands it's `client:only` so the
  preview SSR functions don't choke on it.

### Adding schools — 3 paths (detail in ADDING-A-SCHOOL.md)

1. **Studio form** — https://xtrapoint.sanity.studio (non-technical).
2. **Bulk import** — `cd studio && IMPORT_FILE=import/x.json npm run import`
   (`PUBLISH=1` for live; else drafts). `studio/scripts/import.ts`.
3. **Auto-seed a college** — `cd studio && SEARCH="oregon" npm run seed:college`
   to find ESPN's name, then `COLLEGE="Oregon Ducks" npm run seed:college` →
   review-ready draft (mascot/color/logo-preview from ESPN; optional city/state +
   official name from College Scorecard if `DATAGOV_API_KEY` is in `.env`).
   `studio/scripts/seed-college.ts`. All run via `sanity exec --with-user-token`
   (operator's login — no separate write token).

### Publish → rebuild

Sanity **publish webhooks** → **Vercel Deploy Hooks** (one for `staging`, one for
`main`), filtered to `school` docs (drafts excluded). Publishing rebuilds both
sites — no code/git. (Content pipeline; code still ships via staging→main merge.)

## 📄 Legal pages (Terms & Privacy) — CMS-driven rich text

`/terms` and `/privacy-policy` are driven by Sanity, same read path as schools.

- **One doc type** `legalPage` (Studio → **Legal pages**): title, slug (= the
  URL), short `navLabel`, `lastUpdated`, and a **Portable Text `body`**. One
  **dynamic route** `src/pages/[legal].astro` renders all of them — add a doc,
  get a page + cross-links, no code.
- **Editing:** in the Studio, edit the `body` rich text; H2/H3 headings become the
  sticky **table-of-contents** automatically (Stripe-guides scrollspy). Publishing
  rebuilds the site (webhook — see below; note the webhook filter, next bullet).
- **Data layer** — `src/data/legalSource.ts` (`getLegalPages()`/`getLegalPage()`),
  `src/data/legal.ts` (`renderLegalBody()` → `{html, toc}` via
  `@portabletext/to-html`; **coordinated heading-id pass** so TOC anchors match).
- **Seed / re-seed** the two pages: `cd studio && PUBLISH=1 npm run seed:legal`
  (`studio/scripts/seed-legal.ts`; omit `PUBLISH=1` for drafts). Content is
  editable in the Studio afterward.
- **⚠ Content is seeded, not legally reviewed** — see Open item #10. Copy is
  LaCore's LPT text, adjusted so XtraPoint reads as a DBA of LaCore Payments
  Technologies, Inc.; Department Contacts section was dropped per request.
- **⚠ Publish webhook filter:** the Sanity→Vercel deploy hooks are filtered to
  `school` docs. If publishing a `legalPage` edit should auto-rebuild, widen the
  webhook filter to include `legalPage` (or trigger a deploy manually). See
  "Publish → rebuild" above.

## 👁 Draft preview (school pages) — secret-gated, on-demand

Editors can preview a school's **unpublished draft** on the real page before
publishing (Option A — no visual-editing overlays yet).

- **Studio:** ⋯ menu on a doc → **"Open preview"** (eye icon). **School** docs get
  two: *Open preview* (donor) + *Preview ambassador page*; **legal** docs get one.
  Via `studio/previewAction.ts` (a `makePreviewAction` factory) + `document.actions`
  in `sanity.config.ts`. Icon from `@sanity/icons@^3` (React-18 compatible — v5
  needs React 19).
- **Routes** (`prerender = false`; shared secret gate `src/lib/previewGuard.ts`):
  - `preview/schools/[slug]` → `SchoolLanding.astro` (donor)
  - `preview/schools/[slug]/ambassadors` → `SchoolAmbassadors.astro`
  - `preview/legal/[slug]` → `LegalPageView.astro`
  Each renders the **same component** as the live route, from the **draft**
  (`getSchoolDraft()` / `getLegalPageDraft()` — a `previewClient` with the
  `previewDrafts` perspective). So preview == production fidelity.
- **⚠ Extracted shared components** back the static + preview routes:
  `SchoolLanding`, `SchoolAmbassadors`, `LegalPageView`. Edit the page there.
  Their client islands (DotField, ContactForm, WaitlistForm) are **`client:only`**
  so the on-demand SSR function never server-renders browser-only deps (three.js,
  @hcaptcha) — see the DECISIONS gotcha. Trade-off: those islands render
  client-side on the live school pages too (mount after load).
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
| `DATAGOV_API_KEY` | local `.env` only (optional) | Auto-seed city/state via College Scorecard |
| `PUBLIC_WEB3FORMS_KEY` | `.env` + Vercel | Contact/waitlist form delivery |

## Open items / follow-ups

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
