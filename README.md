# Xtra Points — marketing site

Fast, static marketing site for **XtraPoints**, rebuilt from the live Webflow page
(`lacore.webflow.io/xtra-points`) as a production Astro app. Two pages: a home
landing page and a `/contact` "Get Started" page with a working form.

## Stack

| Concern        | Choice                                              |
| -------------- | --------------------------------------------------- |
| Framework      | Astro 6 (`output: 'static'`)                        |
| Interactivity  | `@astrojs/react` — islands only                     |
| Styling        | Tailwind v4 (`@tailwindcss/vite`)                   |
| UI components  | shadcn/ui (button, card, badge, input, label, textarea, select, tabs) |
| Animation      | Framer Motion (count-ups, live feed); CSS-only marquee |
| Deploy         | Vercel static (`@astrojs/vercel`)                   |
| Sitemap        | `@astrojs/sitemap`                                  |

Verified current versions at build time: Astro 6.4.4, @astrojs/react 5.0.7,
@astrojs/vercel 10.0.8, Tailwind 4.3.0, React 19.2.7, framer-motion 12.40.0.

## Run locally

```sh
npm install
npm run dev      # http://localhost:4321  — serves / and /contact
npm run build    # static build → ./dist  (also emits .vercel/output for Vercel)
npm run preview  # preview the production build
```

## Project layout

```
src/
  styles/globals.css         # ← ALL design tokens (colors + fonts) live here, @theme. No hardcoded hex/px in components.
  layouts/Layout.astro       # <head>, SEO/OG/Twitter, fonts, canonical
  components/
    Header.astro Footer.astro CtaButton.astro Eyebrow.astro   # shared, reused by both pages
    home/*.astro             # one file per landing-page section (static)
    islands/*.tsx            # React islands (hydrated): CountUp, StatTrio, DonorDashboard, LiveFeed, ContactForm
    ui/*.tsx                 # shadcn components
  pages/index.astro          # home
  pages/contact.astro        # /contact
public/
  assets/                    # owned brand SVGs + OG image, favicon
  images/                    # photos (⚠ stock — see below)
```

### Islands & hydration (kept above-the-fold light)

- `StatTrio` (hero stats) — `client:visible`
- `DonorDashboard` (§03 count-ups + chart) — `client:visible`
- `ContactForm` — `client:load`
- `LiveFeed` (final CTA donation ticker) — `client:load`
- Audience marquee and the phone/campaign mockups are **static** (zero JS); the
  marquee and phone progress bar are CSS-only animations.

### Motion & decoration (matches the original page)

- **Scroll reveals**: `.reveal` / `.reveal-left` / `.reveal-right` (and `.stagger`
  for sequenced children) are defined in `globals.css`; a tiny inline
  IntersectionObserver in `Layout.astro` adds `.is-visible` on entry. Base state
  only hides when JS is active (`.js` on `<html>`) and is disabled under
  `prefers-reduced-motion`, so content is never stuck hidden.
- **Hero**: word-by-word rise (`.hero-word`, staggered `animation-delay`).
- **Editorial accents**: Permanent Marker lime words inside Anton headings via
  `.ed` (dark sections) / `.ed .ed-dark` (light sections).
- **Playbook marks**: `PlaybookMark.astro` renders the brand SVGs
  (`ex`/`oh`/`arrow`/`underline`) as lime masks — the scattered ✕/◯ chalk marks.
- **Atmosphere**: `.dot-grid` texture, drifting `.glow` blobs, and the giant
  outlined `.backdrop-type` word — all decorative and `aria-hidden`.

## Design tokens

Brand colors and fonts were pulled from the live page and defined **once** in
[`src/styles/globals.css`](src/styles/globals.css) under `@theme` (e.g.
`--color-lime: #aaf10a`, `--color-ink: #03116d`, `--font-display: "Anton"`,
`--font-editorial: "Permanent Marker"`, `--font-mono: "Space Mono"`,
body `Inter`). shadcn semantic tokens are mapped onto that palette. Components
reference tokens only — no hardcoded hex/px.

## Brand name / domain toggle

The brand name, domain, all public emails, and which logo art renders are
controlled from **one file**: [`src/config/brand.ts`](src/config/brand.ts).
Flip a single switch:

```ts
export const PLURAL = false; // false → "XtraPoint" / xtrapoint.com
                             // true  → "XtraPoints" / xtrapoints.com
```

Changing it updates: the wordmark in copy, the `<title>`/OG tags, the singular
vs plural **logo** (header + footer), `sales@…` links, the dashboard mock URL,
and the site/canonical/sitemap/robots domain (`astro.config.mjs` reads
`brand.url`). Two things that live **outside** the build must be matched by hand
when you flip it:

- **Vercel custom domain** must match (xtrapoint.com vs xtrapoints.com).
- **Web3Forms key** must be created for the matching `sales@…` inbox (the key
  determines the delivery address — see below).

## Contact form (Web3Forms)

The form posts client-side to [Web3Forms](https://web3forms.com) and emails
submissions to **sales@xtrapoints.com**.

**➡ You must add your access key:**

1. Go to https://web3forms.com and create a free Access Key using the inbox
   **sales@xtrapoints.com** (Web3Forms delivers to the email the key is created
   for — this is how submissions reach sales@xtrapoints.com).
2. Copy `.env.example` → `.env` and paste the key:
   ```
   PUBLIC_WEB3FORMS_KEY=your-key-here
   ```
3. Restart `npm run dev`. In Vercel, add the same var under
   **Project → Settings → Environment Variables** (name `PUBLIC_WEB3FORMS_KEY`).

Until a key is set, the form validates but shows a "not configured yet" message
on submit. Features: required-field + email validation with inline errors,
inline success/error states (no reload), submit disabled while sending, a hidden
subject line (`New XtraPoints inquiry from {organization}`), and a honeypot field.

> **Later (not built now):** this can be swapped to an Astro server endpoint +
> [Resend](https://resend.com) to send from our own domain instead of a
> third-party service. That would require switching `output` to `server`/hybrid
> for the `/api/contact` route.

## SEO

- Home `<title>`: "Xtra Points" + the original meta description + OG/Twitter
  tags (OG image at `/assets/og-image.png`).
- Contact: own title/description ("Get Started with Xtra Points").
- `public/robots.txt`, sitemap (`/sitemap-index.xml`, both pages), favicon
  (brand monogram `public/favicon.svg`).

## Assets — flags to review before launch

- ⚠ **Stock photos**: `public/images/why-01-stock.jpg` and `why-02-stock.jpg`
  in §06 "Why it works" are **Pexels stock** from the live page. Replace with
  owned XtraPoints imagery.
- `public/assets/og-image.png` is the LPT Partner OG card from the live page —
  consider an XtraPoints-specific OG image.
- Owned brand SVGs downloaded to `public/assets/` (`xtrapoints-logo-white.svg`,
  `icon.svg`, plus `arrow/underline/oh/ex.svg` editorial marks).

## Links — confirm before launch

Per the brief, links were normalized (not copied verbatim from the live page):

- All "Get Started" CTAs → internal `/contact`.
- Sales email → `mailto:sales@xtrapoints.com` (the live page mislinked this to
  `sales@lpt.io`).
- Ambassador CTA → `mailto:sales@xtrapoints.com` (the live page's `xtrapoint.com`
  was a typo — not reproduced).
- Footer corporate emails (support/press/billing/security) → kept `@lpt.io`.
- ⚠ **Footer company/resource links**: the live page used root-relative paths
  (`/company`, `/security`, `/partners`, `/press`, `/terms`, `/privacy-policy`)
  that resolve to the **lacore.webflow.io staging host**. They are remapped to
  the production domain `https://www.lpt.io/...` in
  [`Footer.astro`](src/components/Footer.astro). **Confirm these production URLs
  exist** (or adjust). External links (`foundry.lacorepayments.com`,
  `live.standards.site/lpt`, LinkedIn) were kept as-is.

## Deploy to Vercel + domain (xtrapoints.com)

The build is static and the `@astrojs/vercel` adapter is configured, so Vercel
deploys it as static hosting. **DNS is not changed by this repo** — you enter the
records Vercel shows you, at your registrar.

> ⚠️ `app.xtrapoints.com` is a separate existing subdomain for the product app.
> Only the **apex** (`xtrapoints.com`) and **www** are configured below — do not
> touch the `app` record.

1. **Push & import**: push this repo to GitHub, then in Vercel
   **Add New → Project → Import**. Framework preset auto-detects Astro; build
   command `npm run build`, output handled by the adapter. Add the
   `PUBLIC_WEB3FORMS_KEY` env var. Deploy.
   - Or via CLI: `npm i -g vercel && vercel --prod` (requires `vercel login`).
2. **Add domains**: Project → **Settings → Domains**:
   - Add `xtrapoints.com` (apex).
   - Add `www.xtrapoints.com` and choose **Redirect to `xtrapoints.com`**
     (www → apex redirect).
3. **Read the exact DNS values Vercel displays** for the apex and www records
   (an `A` record for the apex and a `CNAME` for www — Vercel shows the exact
   targets for your account). **Send those exact values to be entered at the
   registrar.** Do not invent values; do not edit the `app` record.
4. After the records propagate, confirm in Vercel that **SSL is issued** and that
   `https://xtrapoints.com` resolves and `https://www.xtrapoints.com` redirects
   to the apex.

## Notes

- `npm audit` reports a high finding in `path-to-regexp` reached transitively
  through `@astrojs/vercel`. It is a **build-time** dependency (route matching),
  not shipped to the browser. The only `audit fix` is a breaking downgrade of the
  adapter to v8; left as-is. Revisit when the adapter bumps the transitive dep.
- `_reference/` holds a local snapshot of the source page (git-ignored).
