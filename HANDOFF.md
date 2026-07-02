# Session handoff — XtraPoint marketing site

Pick-up notes for continuing in a fresh chat. Start a new chat **in this project**
and say: _"Read HANDOFF.md and README.md, then let's continue."_

> Reference docs: [README.md](README.md) (run/build, brand toggle, contact form),
> [ADDING-A-SCHOOL.md](ADDING-A-SCHOOL.md) (the co-branded school pages),
> [docs/deploys-and-indexing.md](docs/deploys-and-indexing.md) (envs + SEO),
> [DECISIONS.md](DECISIONS.md) (why). This file is **current state + open items**.

_Last updated: 2026-07-01._

---

## Where things stand (git / deploy)

- **`main` and `staging` are in sync** (both at `1580836`) and both are **live**:
  - **Production** = `xtrapoint.com` (apex → `www` redirect), builds from **`main`**.
  - **Staging** = `staging.xtrapoint.com`, builds from the **`staging`** branch.
- Everything below is deployed to **both**. School pages render on production.
- **Promotion flow**: production ships by merging `staging` → `main`
  (`git checkout main && git merge --ff-only staging && git push origin main`).
  New routes 404 on prod until they're on `main` (prod builds from `main`; Astro
  generates static routes at build).

## Stack / how to run

Astro 6 (static) + React islands + Tailwind v4 + shadcn/ui + Framer Motion +
GSAP + Three.js/R3F/Rapier (homepage lanyard). Deploy: Vercel (`@astrojs/vercel`).

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static build — the source of truth for "is it broken"
```

## Architecture worth knowing

- **Brand toggle** — `src/config/brand.ts`. One `PLURAL` switch controls name,
  domain, emails, logo art. Currently **`false` → "XtraPoint" / xtrapoint.com**.
  `astro.config.mjs` reads `brand.url`.
- **Design tokens** — `src/styles/globals.css` `@theme`. Brand lime `#aaf10a`,
  ink `#03116d`, `--color-on-accent` (text on accent buttons; defaults to ink),
  fonts Anton / Permanent Marker / Space Mono / Inter.
- **Editorial accents** — `.ed` (handwritten Permanent Marker accent word inside
  Anton headings); `.ed-dark` for light sections.
- **Motion** — scroll-reveal (`.reveal` / `.reveal-left/right` / `.stagger` +
  IntersectionObserver in `Layout.astro`); `PlaybookMark.astro`; `.glow`,
  `.dot-grid`, `.backdrop-type`.

## 🎓 Co-branded school pages (the big system — read ADDING-A-SCHOOL.md)

Two pages per school, **generated entirely from one registry entry** in
`src/data/schools.ts`: `/schools/[slug]` (donor) and `/schools/[slug]/ambassadors`.
Theming re-skins the whole design by overriding global tokens per page
(`schoolThemeVars`). **Two schools live: `sam-houston`, `westminster`.**

- **Registry fields** (`School`): name/short/mascot/fund/city/state; `theme`
  (primary/primaryDeep/primaryDark/primarySoft/ink + optional `onAccent`);
  optional `logo` (+ `logoBadge`, `logoClass`), `mark` (accent-tinted icon),
  `avatar` (full-color app-mockup logo), `photos` (team/fans/celebrate/mascot/action).
- **Components** (`src/components/school/`): `SchoolHeader`, `SchoolPhone`
  (app mockup), `SchoolPhotoBand` (full-bleed spirit band). Islands used:
  `DotField` (hero bg, ReactBits — replaced the old DotGrid on school heroes),
  `DonorDashboard`, `ContactForm`, `WaitlistForm`.
- **Donor page = pre-launch WAITLIST** (the app isn't live yet; Plaid finalizing
  min fields, ETA ~early July). Donor page collects name+email+phone via
  `ContactForm variant="interest"`; university portal/dashboard sections were
  removed (they were org-facing). Copy is consumer/excitement-focused.
- **Ambassador page** — separate: what it is / how it works / criteria /
  incentives (Bronze/Silver/Gold) / enroll. Enroll is a **placeholder inline
  `WaitlistForm`** (real application pending, must be university-approved).
- **Auto OG cards** — each school emits a 1200×630 share image at
  `/schools/<slug>/og.png`, wired into both pages' `og:image`/`twitter:image`.
  Mirrors the hero from `logo` + `theme`; no per-school work. Generator:
  `src/og/renderSchoolOg.ts` (satori + `@resvg/resvg-js`, fonts in `src/og/fonts/`).
  **On-demand** (`prerender = false`): a Vercel Node function generates each card
  once, then it's CDN-cached (build time no longer scales with school count).
  Fonts + co-brand logos are bundled into the function via `includeFiles` in
  `astro.config.mjs` (logo list derived from the registry).
- **Content comes from Sanity (staging)** — `src/data/schoolsSource.ts`
  (`getSchools()`/`getSchool()`) queries Sanity via GROQ; page templates + the OG
  endpoint read only through it. Client: `src/config/sanity.ts` (project
  `xjhhxbqk` / `production`, `SANITY_READ_TOKEN` server-side — Vercel
  Production+Preview + local `.env`; the token is required, the dataset's public
  toggle does not grant anonymous doc reads). Studio (schema + editor) lives in
  `studio/`, hosted at **https://xtrapoint.sanity.studio**. Editors set only
  `primary` + `ink`; the deep/dark/soft shades are derived (`deriveSchoolTheme`
  in `src/data/schools.ts`). School logos/photos are served from the Sanity CDN;
  the OG function fetches the logo from there at runtime. The in-repo `schools`
  array is now unused (reference only — prune later). **Live on production**
  (main + staging both Sanity-backed). Publishing a school in the Studio triggers
  a rebuild via a Sanity webhook → Vercel Deploy Hook (staging wired; prod hook
  set up during promotion). Adding school #N is now a Studio form entry, not code.

## Forms (Web3Forms)

- All forms post to **Web3Forms** with the single `PUBLIC_WEB3FORMS_KEY`
  (`.env` + Vercel) → one inbox (`sales@xtrapoint.com`). Variants tag submissions
  by `type` + subject (App sign-up / Waitlist / Ambassador waitlist / inquiry).
- **hCaptcha** on the full ContactForm (shared free sitekey; must be enabled in
  the Web3Forms dashboard). The compact `WaitlistForm` uses honeypot only.
- ⚠ Ambassador submissions should eventually route to a **dedicated inbox**
  (`enrollment@` / `ambassadorprogram@xtrapoint.com`) — needs a separate Web3Forms
  key (concept: a `PUBLIC_WEB3FORMS_KEY_AMBASSADOR` env var). Not implemented yet.

## Environments & SEO indexing (done — see docs/deploys-and-indexing.md)

- **Staging/preview are de-indexed; production is indexable.** Keyed on
  `VERCEL_ENV` at build time via `src/config/site-env.ts`
  (`shouldNoindex = Boolean(VERCEL_ENV) && VERCEL_ENV !== "production"` — an
  allowlist so **production can never be accidentally noindexed**).
- Three layers: dynamic `robots.txt` (`src/pages/robots.txt.ts`), `<meta robots>`
  in `Layout.astro`, and an `X-Robots-Tag` header via `vercel.json` (matched by
  **hostname** — staging + `*.vercel.app`, never production hosts).
- ⚠ `vercel.json` only allows known keys (no `comment`/arbitrary props).

## Open items / follow-ups

1. **Vercel Deployment Protection** (password/SSO) on staging/preview — dashboard
   toggle; the stronger lock on public staging access (de-indexing ≠ private).
2. **Ambassador waitlist inbox** — route to a dedicated Web3Forms key (above).
3. **Shared Footer is B2B-flavored** on the consumer school pages ("recurring
   donor revenue… for the team behind the team", links to removed sections).
   Decide: lighter consumer footer on school pages, or leave.
4. **Homepage stock photos** — §06 uses Pexels (`public/images/why-0{1,2}-stock.jpg`);
   replace with owned imagery. Footer Terms/Privacy still point to `lpt.io`.
5. **Westminster crest wordmark** asset exists if you ever want it beyond the header.
6. `npm audit` high finding is build-time only (`path-to-regexp` via the Vercel
   adapter), not shipped to browsers.

## Dev gotchas

- **React/Three islands don't hot-reload cleanly.** After changing an island or a
  CSS `@theme` token, restart the dev server and clear the cache:
  `rm -rf node_modules/.vite .astro` then restart. The **production build is the
  source of truth**.
- **zsh doesn't treat `#` as a comment interactively** — pasted commands with
  trailing `# notes` pass the note as args (breaks `head`/`grep`/`curl`). Strip
  comments or `setopt interactive_comments`.
- Preview screenshots race `scroll-behavior: smooth`; scroll with
  `behavior:'instant'` first. The screenshot tool also struggles with very
  deep-scrolled sections — verify those via DOM/computed-style checks instead.
