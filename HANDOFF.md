# Session handoff — XtraPoint marketing site

Pick-up notes for continuing in a fresh chat. Start a new chat **in this project**
and say: _"Read HANDOFF.md and README.md, then let's continue."_

> Reference docs: [README.md](README.md) (run/build, brand toggle, contact form),
> [ADDING-A-SCHOOL.md](ADDING-A-SCHOOL.md) (the co-branded school pages + the 3
> onboarding paths), [docs/deploys-and-indexing.md](docs/deploys-and-indexing.md)
> (envs + SEO), [DECISIONS.md](DECISIONS.md) (why). This file is **current state**.

_Last updated: 2026-07-02._

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

## Forms (Web3Forms) — unchanged

All forms post to Web3Forms (`PUBLIC_WEB3FORMS_KEY` in `.env` + Vercel) →
`sales@xtrapoint.com`. hCaptcha on the full ContactForm; honeypot on WaitlistForm.

## Environments & SEO — unchanged (see docs/deploys-and-indexing.md)

Staging/preview de-indexed, production indexable (keyed on `VERCEL_ENV`).

## Env vars summary

| Var | Where | Purpose |
| --- | --- | --- |
| `SANITY_READ_TOKEN` | Vercel Prod+Preview **and** local `.env` | Read school content at build + OG runtime (required) |
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
7. Homepage §06 stock photos (Pexels); Footer Terms/Privacy point to `lpt.io`.

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
