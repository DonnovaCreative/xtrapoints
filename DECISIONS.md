# Decisions

Short log of non-obvious engineering decisions. Newest first.

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

See [docs/deploys-and-indexing.md](docs/deploys-and-indexing.md).

---

## 2026-07-01 — Production ships from `main`; promote via merge

**Context:** `/schools/*` rendered on staging but 404'd on `www.xtrapoint.com`.
Root cause: the school pages existed only on the `staging` branch; production
builds from `main`, and Astro generates those routes from `getStaticPaths()` at
build time — so the production build never produced them.

**Decision:** Treat `main` as the production source of truth. New routes reach
production only when merged to `main` (which triggers the Vercel production
deploy). Not an env/config issue — purely unmerged code.
