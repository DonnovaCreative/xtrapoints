# Decisions

Short log of non-obvious engineering decisions. Newest first.

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
