# Xtra Points — marketing site

Fast, static marketing site for **XtraPoints**, rebuilt from the live Webflow page
(`lacore.webflow.io/xtra-points`) as a production Astro app. Two pages: a home
landing page and a `/contact` "Get Started" page with a working form.

## Documentation

Deeper docs live in [`docs/`](docs):

| Doc | What it covers |
| --- | --- |
| [docs/HANDOFF.md](docs/HANDOFF.md) | **Start here** — current state, git/deploy flow, gotchas |
| [docs/COMMANDS.md](docs/COMMANDS.md) | Everyday terminal commands (dev, commit, deploy, Sanity) |
| [docs/ADDING-A-SCHOOL.md](docs/ADDING-A-SCHOOL.md) | Adding co-branded school pages + editing legal pages |
| [docs/deploys-and-indexing.md](docs/deploys-and-indexing.md) | Environments + search-engine indexing control |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Log of non-obvious engineering decisions (why) |

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
- **HubSpot form** notification recipients should match the `sales@…` inbox for
  the domain you flipped to (set in HubSpot, not here).

## Forms

Three forms, three destinations — but **one endpoint**. Every form POSTs the same
payload shape to `/api/lead` ([src/pages/api/lead.ts](src/pages/api/lead.ts)),
which decides where it goes:

| Form | Where it lives | Destination |
| --- | --- | --- |
| B2B sales inquiry | `/contact` | HubSpot CRM |
| Donor waitlist | school landing page | Google Sheets |
| Ambassador waitlist | school ambassadors page | Google Sheets |

The React components are deliberately dumb: they collect fields and post. Which
vendor receives a submission is a one-file change, not an edit across three
components.

**Why a server route** (the forms used to post straight to Web3Forms from the
browser): the Apps Script URL and the hCaptcha secret must not ship to the
browser, the captcha token has to be verified somewhere a bot can't skip, and
there needs to be one place to fan out to CRM + sheet + notification.

### HubSpot (the contact form)

Submissions go to the **Forms API** (`api.hsforms.com/submissions/v3/...`), which
needs no auth token — the portal id and form GUID are public by design. It runs
the form's HubSpot-side automation (notifications, workflows, lifecycle stage),
so sales can change routing without a deploy.

```
PUBLIC_HUBSPOT_PORTAL_ID=246921674
HUBSPOT_FORM_GUID=<the form's data-form-id>
```

**Two things that will break it:**

1. **Captcha must stay OFF for that form in HubSpot.** With bot protection on,
   the API refuses every submission with `FORM_HAS_RECAPTCHA_ENABLED` — it's a
   refusal, not a warning. Spam prevention is hCaptcha on our side instead.
2. **Never send a field the HubSpot form doesn't define** — HubSpot rejects the
   *entire* submission. The field list is `FIELD_MAP` in
   [src/lib/hubspot.ts](src/lib/hubspot.ts); it must mirror the form. Note
   `organization_type` is a **Company** property (`0-2/`), not a Contact one.

If HubSpot rejects a submission anyway, the route falls back to writing the lead
to the Google Sheet rather than dropping it. A sales lead is too expensive to
lose to a form-config mistake.

#### Consent (data privacy)

The HubSpot form has "Data privacy options" enabled with two **required**
checkboxes — communications opt-in and data-processing consent. The site form
renders both and blocks submission until they're checked.

⚠ **HubSpot does not enforce this for API submissions.** A payload with no
`legalConsentOptions` at all returns `200` and creates the contact with no
consent recorded — silently. The validation in
[src/lib/leads.ts](src/lib/leads.ts) is the only thing that makes those required
checkboxes real, so don't "simplify" it away.

Consent wording lives in [src/lib/consent.ts](src/lib/consent.ts) and is imported
by **both** the form UI and the API payload. HubSpot stores the `text` as the
record of what the person was shown, so if those two drifted apart your CRM would
hold evidence of consent to wording nobody ever saw. If you edit the wording in
HubSpot, edit it there.

```
HUBSPOT_SUBSCRIPTION_TYPE_ID=<Settings → Marketing → Email → Subscription Types>
```

If that's unset the form still works and still records processing consent; only
the subscription opt-in is omitted — erring toward recording *less* consent than
was given.

### Google Sheets (the two waitlists)

Rows are appended by a **Google Apps Script Web App** bound to the workbook.
Setup is documented at the top of
[scripts/apps-script/Code.gs](scripts/apps-script/Code.gs) — about five minutes,
no GCP project, no service account, no new dependency.

```
SHEETS_WEBHOOK_URL=<the Apps Script /exec URL>
SHEETS_SECRET=<must match SECRET inside the script>
```

**Per-school separation:** one workbook, two tabs per school
(`University at Albany — Donors`, `University at Albany — Ambassadors`), created
automatically on that school's first submission. Launching school #2 needs no
spreadsheet setup at all.

Per-school CSV is already built in: in the sheet, **File → Download → CSV**
exports the active tab only.

⚠ **Tabs separate data, not access.** Google sharing is per *file*. If schools
ever need to see their own leads, don't split this into one workbook per school —
serve it from `/portal/[school]`, which is already Clerk-gated per school org.

### hCaptcha

The contact form only. Uses **our own** hCaptcha account, verified server-side in
[src/lib/hcaptcha.ts](src/lib/hcaptcha.ts):

```
PUBLIC_HCAPTCHA_SITEKEY=<renders the widget>
HCAPTCHA_SECRET=<server only>
```

This previously used Web3Forms' shared sitekey, which worked only because
*Web3Forms* did the verifying. There is now deliberately **no fallback sitekey**:
if it's unset the widget is hidden rather than rendered as decoration. The two
waitlist forms have no captcha by design — they're one-line sign-ups where a
captcha costs more real applicants than the spam is worth; they use the honeypot.

### HubSpot tracking + cookie consent

The tracking script loads in [Layout.astro](src/layouts/Layout.astro) **only on
the Vercel Production deploy** (`isProduction`, see
[src/config/site-env.ts](src/config/site-env.ts)).

That is a consent decision, not tidiness: the script sets `hubspotutk`, a
non-essential analytics cookie, so it may only run where a cookie banner can gate
it. Banners are configured in HubSpot for `xtrapoint.com` and `www.xtrapoint.com`
— **not** staging. Keeping it off preview/local also stops QA traffic polluting
HubSpot analytics.

The `hubspotutk` cookie is forwarded with contact submissions as `hutk`, which is
what attributes a lead to that visitor's browsing history. It's absent whenever
someone declines cookies — that's normal, and the payload omits it rather than
sending an empty value.

### Web3Forms (archived)

The previous destination for every form. Kept **wired but dormant** in
[src/lib/web3forms.ts](src/lib/web3forms.ts) in case the team moves off HubSpot —
code that stays wired to live field names doesn't rot against a form shape that's
moved on.

It runs only when `WEB3FORMS_KEY` is set, and that var is deliberately unset in
Vercel. Setting it re-enables email notification alongside the real destination;
that is the entire re-activation procedure. (It lost its `PUBLIC_` prefix when it
moved server-side.)

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
- Footer **Terms / Privacy** → internal `/terms` + `/privacy-policy` (own
  CMS-driven legal pages — see HANDOFF.md "Legal pages"). Previously linked to
  `lpt.io`.
- ⚠ **Footer company/resource links**: the live page used root-relative paths
  (`/company`, `/security`, `/partners`, `/press`) that resolve to the
  **lacore.webflow.io staging host**. They are remapped to the production domain
  `https://www.lpt.io/...` in [`Footer.astro`](src/components/Footer.astro).
  **Confirm these production URLs exist** (or adjust). External links
  (`foundry.lacorepayments.com`, `live.standards.site/lpt`, LinkedIn) were kept
  as-is.

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
