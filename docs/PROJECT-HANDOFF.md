# XtraPoint site — project handoff

A standalone onboarding doc for a **new owner / new Claude account** taking over
the XtraPoint marketing site. Read this top-to-bottom once, then keep the deeper
in-repo docs (linked at the bottom) as reference.

> **First message to a fresh Claude Code session (run inside the repo):**
> _"Read docs/PROJECT-HANDOFF.md, then docs/HANDOFF.md and README.md. Confirm the
> git state (`git log main..staging --oneline`) and tell me what's held from
> production before we start."_

_Prepared: 2026-07-29._

---

## 1. What this is

**XtraPoint (XP)** is a fundraising platform for schools (donors round up / give
through a school-branded fund; ambassadors sign up). This repo is the **marketing
site** — the public homepage, the contact/waitlist forms, the legal/support pages,
and the **co-branded per-school landing pages** (donor + ambassador + an
auto-generated OG image and a printable one-pager sell sheet). School and legal
content is managed by non-technical editors in **Sanity CMS**, not in code.

- **Production:** https://xtrapoint.com (apex → www)
- **Staging:** https://staging.xtrapoint.com
- **Hosted Studio (CMS editor):** https://xtrapoint.sanity.studio

## 2. Stack

Astro 6 (static pages + on-demand SSR "islands") · React 19 islands · Tailwind v4
· shadcn/ui · Framer Motion + GSAP · Three.js / React-Three-Fiber (homepage
lanyard) · Sanity CMS (content) · **Vercel** (hosting/deploys) · Web3Forms (form
delivery). Node **22.x** (see `package.json` `engines`; repo builds on 22 — a
local 24 works for dev but match 22 for parity).

## 3. Access to transfer (the important part)

The code is only half of it — the new owner needs to be granted access to these
external accounts. **None of these are in the repo; hand them over securely.**

| System | What / where | Who owns it now |
| --- | --- | --- |
| **GitHub** | `github.com/DonnovaCreative/xtrapoints` (private). Add the new owner as a collaborator, or transfer the repo. | DonnovaCreative |
| **Vercel** | The project hosting `xtrapoint.com` + `staging.xtrapoint.com`. Holds the production env vars and the Sanity → Vercel **Deploy Hooks**. Add them to the Vercel team/project. | Corey / Donnova |
| **Sanity** | Project `xjhhxbqk`, dataset `production`. Invite as a member. ⚠ A scoped **editor** role needs the paid plan tier; on the free tier invited members are admins. | Corey |
| **Web3Forms** | Access key delivers contact/waitlist submissions to `sales@xtrapoint.com`. hCaptcha is enabled in its dashboard. | Corey |
| **Domain / DNS** | `xtrapoint.com` registrar + DNS (points apex→www + staging subdomain at Vercel). | Corey |
| **Figma** | The one-pager sell sheet is built 1:1 from Figma file `W4w45f3JV7E4AFSiFSymdO` (node `1:118`). Share the file. | Corey |

**Secrets** (real values live in the local `.env` and in Vercel's env settings —
**never paste them into this doc or any shared channel**): transfer them via a
password manager or Vercel's own env UI. See §6 for the list of names.

## 4. Get it running locally

```sh
git clone https://github.com/DonnovaCreative/xtrapoints.git
cd xtrapoints
npm install
cp .env.example .env          # then fill in the secret values (see §6)
npm run dev                   # http://localhost:4321
```

```sh
npm run build                 # real production build — the true "is it broken?" test
npm run preview               # serve the built output
```

The **Studio** is a separate app in `studio/` with its own `package.json`:

```sh
cd studio
npm install
npm run dev                   # local Studio (or just use the hosted one)
npx sanity deploy             # redeploy the HOSTED studio AFTER any schema change
```

> Dev gotcha: after editing `src/styles/globals.css` `@theme` or a React island,
> clear the cache — `rm -rf node_modules/.vite .astro && npm run dev`.

## 5. Deploy & content flow

**Two branches, two environments. Code always lands on `staging` first.**

- Push to **`staging`** → rebuilds `staging.xtrapoint.com`. Do this freely.
- Promote to **production** (only after review / client sign-off):
  ```sh
  git checkout main
  git merge --ff-only staging     # fails loudly if main diverged — don't force it
  git push origin main            # rebuilds xtrapoint.com
  git checkout staging
  ```
- **Content** (schools, legal pages) is separate from code: editors publish in the
  Studio and a Sanity **publish webhook → Vercel Deploy Hook** auto-rebuilds
  **staging**. No git involved. **Production does NOT auto-rebuild** (as of
  2026-07-31 — see docs/DECISIONS.md) — an editor clicks the Studio's
  **"Promote to production"** tool once they've reviewed the content on
  staging. ⚠ Publishing **many** docs quickly can trip Vercel's deploy rate
  limit — publish in batches (pause the webhook → publish → re-enable → one deploy).
- Deploy gotcha: a build occasionally gets superseded and doesn't publish.
  Re-trigger with a single empty commit (`git commit --allow-empty`), then wait —
  don't spam pushes.

## 6. Environment variables

Names only — get the values from the current `.env` / Vercel settings and transfer
securely.

| Var | Where it's needed | Purpose |
| --- | --- | --- |
| `SANITY_READ_TOKEN` | local `.env` **and** Vercel (Prod + Preview) | Read school/legal content at build + at OG/PDF runtime. **Required** — the dataset is private, so builds fail without it. Server-only. |
| `PREVIEW_SECRET` | local `.env` **and** Vercel (Prod + Preview) | Gates the draft-preview routes. Must **match** the Studio's `SANITY_STUDIO_PREVIEW_SECRET`. |
| `PUBLIC_WEB3FORMS_KEY` | local `.env` **and** Vercel | Contact/waitlist form delivery. (`PUBLIC_` = exposed to the browser by design.) |
| `DATAGOV_API_KEY` | local `.env`; on Vercel to enable it in the Studio | Optional — auto-fills city/state + official name when seeding a college. |
| Studio: `SANITY_STUDIO_PREVIEW_SECRET`, `SANITY_STUDIO_PREVIEW_ORIGIN` | `studio/.env` (baked in at `sanity deploy`) | The preview secret (must match site `PREVIEW_SECRET`) + which origin previews open against (currently staging). |
| Studio: `SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL` | `studio/.env` (baked in at `sanity deploy`) | The production Vercel Deploy Hook URL, used by the Studio's "Promote to production" tool. |

## 7. Architecture map (where things live)

- **Brand toggle** — `src/config/brand.ts` (`PLURAL` switch drives name/domain/
  emails/logo; currently XtraPoint).
- **Design tokens** — `src/styles/globals.css` `@theme` (brand lime `#aaf10a`, ink
  `#03116d`, Anton / Permanent Marker / Space Mono / Inter).
- **Header** — `src/components/Header.astro` + `SchoolHeader.astro` (fixed overlay,
  glass-on-scroll, hides down / reveals up). Nav items in `src/config/nav.ts`.
  ⚠ Every page's first section must offset for the fixed header
  (`pt-[calc(var(--header-h)+…)]`).
- **Pages** — `src/pages/`: `index.astro` (home), `contact.astro`, `support.astro`,
  `[legal].astro` (one dynamic route renders Terms/Privacy/Refund/Cookie from the
  CMS), `schools/[slug]/…` (donor + ambassador + `og.png.ts` + one-pager
  `.astro`/`.pdf.ts`), `preview/…` (secret-gated draft previews), `api/`.
- **School pages (CMS-driven)** — components in `src/components/school/`; data layer
  in `src/data/schoolsSource.ts` (GROQ → `School` type) + theme helpers in
  `src/data/schools.ts`. **Read `docs/ADDING-A-SCHOOL.md`** — it covers the 3 ways
  to add a school (Studio form incl. "Auto-fill from ESPN", bulk import, terminal
  seed) and the theming model.
- **Legal / Support** — `src/data/legalSource.ts` + `supportSource.ts`; content in
  the Studio under **Legal & Compliance**. Site-wide bits (default explainer video,
  footer legal copy) live in the **Site settings** singleton.
- **One-pager PDF** — printed via headless Chromium (`puppeteer-core` +
  `@sparticuz/chromium`). Has real gotchas (keep everything opaque for PDF export;
  a Vercel `libnss3` fix; Deployment Protection breaks it) — all documented in
  `docs/HANDOFF.md` before you touch it.
- **Studio** — `studio/` (isolated app, React 18, Sanity v3). Schema in
  `studio/schemas/`; custom Studio actions (ESPN auto-fill, draft preview) alongside.

## 8. Current state (as of 2026-07-29)

⚠ **`main` and `staging` are NOT in sync.** `staging` is **ahead** by the Sam
Houston landing-page work, **held from production pending client sign-off**:

- School-pages copy pass (donor + ambassador)
- Collective naming model (`fundShort` / `beneficiary`, e.g. "KatFund") + optional
  custom "Why give" copy + explainer-video fields
- Video refinements + a "Why give" graphic

Run `git log main..staging --oneline` to see the exact held commits. **Do not
promote these to prod without sign-off.**

**Already live on production:** CMS-driven Support page, the "Legal & Compliance"
Studio restructure, Refund + Cookie legal pages, the ESPN "Auto-fill from ESPN"
Studio action, the one-pager draft preview + PDF, and header logo sizing.

## 9. Open follow-ups (not blockers)

- Client to review Sam Houston on staging → then promote the held commits.
- Set the KatFund fields on the real SHSU draft so the full naming treatment shows.
- Produce the XP explainer video → paste URL into Site settings → Default explainer
  video (no deploy needed).
- Grant CMS access to the client-side editor (Isabel) — note the paid-tier caveat
  for scoped roles.
- **Legal copy (Terms / Privacy / Refund / Cookie) is seeded, not lawyered** — it
  needs counsel review in the Studio, plus the footer "free and optional" line.
- Several **test schools** are still published with placeholder data + unverified
  (ESPN) logos — finish or unpublish. Real partners: `sam-houston`, `westminster`.
- More details in the "Open items" list in `docs/HANDOFF.md`.

## 10. What's likely next (roadmap discussed with the client)

Not started — context for planning: a login-protected **Marketing Portal** (asset
templates, CMS-driven auto-content, media library, a partner "playbook" of case
studies); a set of **videos** (30–60s "What is XP?" explainer, program
walkthroughs, vertical-specific, long-form sales); and on the **site**, dedicated
**vertical landing pages** (universities, parishes, high schools, faith-based) plus
a **revenue calculator** built off the pro forma.

## 11. Reference docs (in this repo)

- `README.md` — run/build, brand toggle, contact form
- `docs/HANDOFF.md` — the deep current-state doc (architecture gotchas, PDF/OG
  internals, full open-items list)
- `docs/ADDING-A-SCHOOL.md` — the co-branded school pages + the 3 onboarding paths
- `docs/COMMANDS.md` — everyday terminal commands (dev, commit, promote, seed)
- `docs/deploys-and-indexing.md` — environments + SEO/indexing rules
- `docs/DECISIONS.md` — why things are built the way they are
