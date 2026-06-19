# Session handoff — XtraPoint marketing site

Pick-up notes for continuing in a fresh chat. Start a new chat **in this project**
and say: _"Read HANDOFF.md and README.md, then let's continue."_

> Deep details (run/build, brand toggle, contact form, deploy/domain) live in
> [README.md](README.md). This file is the **current state + open items**.

---

## Where things stand (git)

- Branch: **`main`**. Working tree clean.
- **`origin/main` is live on Vercel** and includes everything through the
  hCaptcha work (hero DotGrid, brand toggle, redesigned footer, favicon, all
  home sections + refinements, lanyard + lazy-load, hCaptcha on the contact form).
- **Local `main` is 1 commit ahead and NOT pushed** — `c16e776` (the SHSU school
  template). So **SHSU is not live yet**. Push with `git push origin main` when ready.
- `staging` exists but is behind; the staging→main flow is already merged. Ignore it
  unless you deliberately want a review branch.
- **Pushing**: the `gh`/git account here (`coreyfromtesouro`) is **read-only** on
  `DonnovaCreative/xtrapoints` — Corey pushes from his authorized account. Claude
  commits locally; Corey runs `git push`.

## Stack / how to run

Astro 6 (static) + React islands + Tailwind v4 + shadcn/ui + Framer Motion +
GSAP (DotGrid) + Three.js/R3F/Rapier (lanyard). Deploy: Vercel.

```sh
npm install
npm run dev      # http://localhost:4321
npm run build    # static build (source of truth for "is it broken")
```

## Architecture worth knowing

- **Brand toggle** — `src/config/brand.ts`. One `PLURAL` switch controls name,
  domain, emails, and which logo art renders. Currently **`false` → "XtraPoint" /
  xtrapoint.com**. `astro.config.mjs` reads `brand.url`.
- **Design tokens** — `src/styles/globals.css` `@theme`. Brand color = lime
  `#aaf10a`, ink navy `#03116d`, fonts Anton / Permanent Marker / Space Mono / Inter.
- **Editorial accents** — `.ed` (handwritten Permanent Marker accent word inside
  Anton headings); `.ed-dark` for light sections.
- **Motion** — scroll-reveal system (`.reveal` / `.reveal-left/right` / `.stagger`
  + IntersectionObserver in `Layout.astro`); `PlaybookMark.astro` (lime ✕/◯/arrow);
  drifting `.glow`, `.dot-grid`, `.backdrop-type`.
- **Islands** — `src/components/islands/`: CountUp, StatTrio, DonorDashboard
  (accepts `fund`), LiveFeed→(removed; final CTA feed is static now), ContactForm
  (accepts `school`), DotGrid (hero bg), Lanyard + LanyardLazy (scroll-gated).

## Contact form (important runtime facts)

- Posts to **Web3Forms** → delivers to **`sales@xtrapoint.com`**.
- Key in `.env` as `PUBLIC_WEB3FORMS_KEY` (also set in Vercel for Production).
- **hCaptcha** is on — uses Web3Forms' free built-in (shared sitekey, no account).
  ⚠ **Must be enabled in the Web3Forms dashboard** for the key, or it isn't verified.
  Shows a "localhost detected" warning in dev (normal); works on the live domain.
- ⚠ Open item (from the meeting): the **xtrapoint.com domain needs the Web3Forms
  verification click** (Jeff set up the domain). Until verified + a key exists for
  that inbox, test submissions won't land.

## 🎯 ACTIVE WORK: SHSU school template (the current focus)

New this session, **committed locally but not pushed**. Corey said it's a great
first run and **has changes coming** (next chat).

- **Reusable co-branded template**: `src/pages/schools/[school].astro`, driven by
  the registry `src/data/schools.ts`. **Adding a school = one registry entry**
  (name, mascot, fund, brand colors, optional logo). Theming works by overriding
  the global accent/ink tokens per page (`schoolThemeVars`), so the whole design
  re-skins to the partner color with no per-section work.
- **SHSU live at `/schools/sam-houston`** in **Bearkat Orange `#F26426`**
  (sampled from the SHSU app mockup at `public/assets/schools/sam-houston/shsu-mockup.png`).
  Sections: co-brand header (XtraPoint × Sam Houston State), round-up hero (themed
  DotGrid + `SchoolPhone.astro` app mockup), how-it-works, donor dashboard
  ("Bearkat Athletics Fund"), marketing, ambassador program, get-started form
  (tagged with the school), footer.
- Goal/context (from Corey's meeting transcript): migrate SHSU off lpt.io onto the
  XP site, **refocused on the Round-Up donation app** (not payments/cards), add
  **ambassador program + donor management + marketing support**, **co-branded &
  swappable** per school. The old lpt.io/partners/shsu page was NOT matched —
  rebuilt fresh in the XP style on purpose.

### SHSU items to confirm / finish (likely the next chat)
1. **Official Bearkat logo** — currently a text/paw **wordmark placeholder**. Drop
   the real SVG at `public/assets/schools/sam-houston/logo-white.svg` and set the
   `logo:` field in the registry (one line). The old page had no clean logo asset.
2. **Confirm orange `#F26426`** and **fund name** ("Bearkat Athletics Fund" vs the
   old "NIL Donor Program").
3. Cosmetic XtraPoint-isms still on the SHSU page: DonorDashboard mock URL slug
   ("bobcat-athletics") and the ContactForm org placeholder ("Bobcat Athletics
   Fund"). Trivial to parameterize/tidy.
4. Decide push timing (hold for real logo vs soft-launch the wordmark version).

## Flagged-but-not-blocking (whole site)

- §06 "Why it works" + §02 background use **Pexels stock photos**
  (`public/images/why-0{1,2}-stock.jpg`) — replace with owned imagery.
- Footer Terms/Privacy point to `lpt.io` (parent) until XtraPoint has its own.
- `npm audit` high finding is build-time only (`path-to-regexp` via the Vercel
  adapter), not shipped to browsers.

## Dev gotchas (so the next session doesn't get confused)

- The preview screenshot races CSS `scroll-behavior: smooth`. To screenshot a
  lower section, scroll with `behavior:'instant'` then screenshot.
- After installing big deps, the dev server spews Vite "Failed to fetch
  dynamically imported module" / re-optimize errors — **dev-only noise**, gone
  after a clean restart. The **production build is the source of truth**.
- R3F/Three components don't hot-reload cleanly; do a full reload.
