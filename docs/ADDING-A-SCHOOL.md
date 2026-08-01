# Adding a co-branded school landing page

Each school automatically gets **two pages**, fully re-skinned to that school:

- `/schools/<slug>` — the **donor** landing page (waitlist)
- `/schools/<slug>/ambassadors` — the **ambassador** program page

…plus an auto-generated 1200×630 social share image at `/schools/<slug>/og.png`,
and an auto-generated **co-branded sales one-pager** (see below).

**School content lives in Sanity**, not in the repo. Editors manage it in the
Studio, and publishing triggers an automatic site rebuild (Sanity webhook →
Vercel Deploy Hook). The Astro templates read it at build time via
[`src/data/schoolsSource.ts`](../src/data/schoolsSource.ts) (GROQ) and map it onto
the `School` shape in [`src/data/schools.ts`](../src/data/schools.ts).

- **Studio (editor):** https://xtrapoint.sanity.studio
- **Project:** `xjhhxbqk` / dataset `production`

---

## Four ways to add schools

### 1. Studio form — the default (no code)

For one-off additions by anyone, technical or not:

1. Go to **https://xtrapoint.sanity.studio** and sign in.
2. **School → Create new**, fill the fields (below), upload the logo + any
   photos, and pick the two brand colors.
3. **Colleges: prefill it automatically.** On the new (empty) school, open the
   ⋯ menu and click **"Auto-fill from ESPN"**, then type the team name (e.g.
   `Oregon Ducks`). It fills in the mascot, brand colors, fund name, and a
   **logo preview** — and city/state + the official name when the DataGov key is
   configured (see below). It only fills **blank** fields, so anything you've
   already typed is safe. ⚠ Colors are approximate and the logo is an
   **unverified preview** — verify the colors, set the dark **ink** color, and
   replace the logo with the partner-approved file before publishing. Colleges
   only (ESPN doesn't list K-12 / non-football schools).
4. **Preview before you publish:** use the **"Open preview"** action (the ⋯ menu
   on the document) to see the draft rendered on the real donor page in a new tab.
5. **Publish.** Within seconds the webhook rebuilds **staging** — the two pages
   + share image go live there first. **Production doesn't auto-update** — when
   you're happy with it on staging, use the **"Promote to production"** button
   (top-level tool in the Studio's left sidebar) to make it live on
   `xtrapoint.com`.
   - **Removing a school works the same way.** Clicking **Unpublish** takes it
     off staging right away, but production won't drop it until you click
     **Promote to production** again — that's expected, not a bug (promoting
     also carries removals live, not just additions).
   - **Want it live on staging but not production** (e.g. a placeholder/test
     school)? Toggle **"Hide from production"** on the school (under the
     Publishing tab) instead of unpublishing, then promote. Flip it back off
     + promote again to bring it back.

> The **Auto-fill from ESPN** button is the browser version of path 3 (the
> terminal `seed:college`). It calls the site's `/api/seed-college` endpoint. To
> also fill **city/state + the official school name**, set `DATAGOV_API_KEY` in
> Vercel (Production + Preview) — a free key from api.data.gov/signup. Without it,
> everything else still works; it just uses ESPN's short name.

### 2. Bulk import — many at once (terminal)

For a batch you already have data for. From `studio/`:

```sh
# drafts (review in the Studio before they go live):
IMPORT_FILE=import/schools.json npm run import
# or straight to live:
IMPORT_FILE=import/schools.json PUBLISH=1 npm run import
```

The manifest is a JSON array; see [`studio/import/example.json`](../studio/import/example.json).
Image fields (`logo`, `mark`, `avatar`, `photos.*`) may be **local file paths**
(resolved from where you run the command — absolute paths are safest) **or remote
URLs**. `slug`, `short`, and `fund` are optional — derived from `name`/`mascot` if
omitted. Requires only your `sanity login` (no separate token).

Besides the basics, the importer maps the full theme + logo-display set:
`secondary`, `onAccent`, `primaryDarkOverride`, and `logoBadge` / `whiteHeader` /
`logoSize` — so a colored-logo school can be set to read on the header (badge or
white bar) straight from the manifest, no per-school toggling in the Studio.

### 3. Auto-seed a college (terminal)

Pulls most of a **college's** data from public sources so onboarding becomes
"confirm + upload the approved logo." From `studio/`:

```sh
SEARCH="oregon" npm run seed:college                    # look up ESPN's exact names (no writes)
COLLEGE="Oregon Ducks" npm run seed:college             # one
IMPORT_FILE=import/colleges.txt npm run seed:college    # one name per line
```

ESPN lists schools by their **team name** (e.g. "Oregon Ducks", not "University
of Oregon"). If a name doesn't match, use `SEARCH=` to find the exact one, or
the tool will list close matches for you to pick from.

It fetches the **mascot, primary color, and a logo preview** from ESPN's public
API and creates a **draft** (never live). Then in the Studio you confirm the
name/city, set the dark **ink** color, **replace the preview logo with the
officially-approved file**, and Publish.

- **Colleges only** — K-12 schools aren't in ESPN; add those via path 1 or 2.
- **ESPN colors are approximate** — verify against the official brand hex.
- **The auto-pulled logo is an unverified preview** — school logos are
  trademarked, so a co-branded page needs the partner's approved logo + sign-off.
- Optional: add `DATAGOV_API_KEY=<key>` to the repo-root `.env` (free key from
  api.data.gov/signup — local only, not needed in Vercel) to also fill the
  official name + city/state from College Scorecard. It searches by the team's
  location and prefers the exact institutional match ("Oregon" → "University of
  Oregon"), so review city/state on the draft — they're best-effort.

---

## The fields

| Field | Example | Notes |
| --- | --- | --- |
| `name` | `Sam Houston State University` | Full legal name — SEO title, alt text. |
| `short` | `Sam Houston State` | Short name in headings + the header lockup. |
| `slug` | `sam-houston` | The URL. Click **Generate** from the short name. |
| `mascot` | `Bearkats` | Plural — used throughout the copy. |
| `fund` | `Bearkat Athletics Fund` | The fund supporters give to. |
| `fundShort` | `KatFund` | **Optional** collective/brand name. When set, the copy reads "give through KatFund", "Become a KatFund Ambassador", "approved by KatFund". Empty → uses the school + fund names as before. |
| `beneficiary` | `Bearkat Athletes` | **Optional** phrase for who donations help. Empty → defaults to "the <Mascot>". |
| `city` / `state` | `Huntsville` / `TX` | Metadata. |
| `logo` | image | **White/mono** logo for the dark header (SVG or PNG). Also the OG lockup. Omit → text wordmark. |
| `logoBadge` | toggle | ON only for a **colored** logo → white badge so it reads on the dark header. |
| `logoLockup` | toggle | "Show school name next to logo." ON for **small/square** logos (common for high schools) → locks the `short` name up as text beside the logo in the header. |
| `logoSize` | preset / Custom | Header logo height: Small 24 / Medium 28 / Large 40 / X-Large 56 / 2X-Large 80 px, or **Custom** → a slider (24–120px). |
| `headerHug` | toggle | OFF (default) = fixed 68px header bar. ON = header has no fixed height and grows to fit the logo — for tall crest/wordmark lockups. |
| `headerPadding` | toggle | Only when `headerHug` is ON. ON (default) adds standard space above/below the logo; turn OFF when the logo file already has margin baked in (header sits tight to it). |
| `mark` | image | Optional single-color icon (e.g. a paw) for the app avatar; tinted to the accent. |
| `avatar` | image | Optional full-color square logo for the app avatar (beats `mark`). |
| `photos.*` | images | `team` / `celebrate` / `fans` / `action` / `mascot` — each optional; pages degrade gracefully. Each photo has an optional **Photo credit** field (photographer/source, e.g. "Jane Doe") shown as a small caption on the photo — leave empty to show none. |
| `whyGiveHeading` / `whyGiveBody` | text | **Optional** (Page copy & media). A fund's own "why give" pitch — when the body is set it replaces the default value-prop cards in the "Why round up" section. One paragraph per blank line. Empty → the standard donor-focused default. |
| `videoUrl` | URL | **Optional** per-school explainer video (YouTube / Vimeo / MP4) shown under the sign-up steps — e.g. a testimonial. **Overrides** the site-wide default (set in **Site settings → Default explainer video**). Empty → the site default. |
| `videoHeading` / `videoCaption` | text | **Optional** heading + one-line caption above the video. Default to generic explainer copy; set them to match a custom video (e.g. "Hear from the Bearkats"). |

### Ambassador program (tiers & recognition)

The Ambassador page's three-tier incentive section and the small recognition
cards ("Ambassador of the Month", "Seasonal campaigns", etc.) default to the
standard XtraPoint copy, but each school can customize them under the
**Ambassador program** tab:

- **Ambassador tiers** — one entry per tier (name, subtitle, a list of perks,
  and an optional "highlight" toggle for the featured tier). Add, remove, or
  reorder tiers freely — it's not locked to exactly three. Leave the whole
  list empty to keep the standard Bronze/Silver/Gold tiers.
- **Recognition & programs** — the small cards below the tiers (title +
  one-line description). Leave empty to keep the standard set (Leaderboards,
  Ambassador of the Month, End-of-year recognition, Seasonal campaigns).

Both come **pre-filled with the standard defaults** — every school (new or
existing) already has them, so customizing means editing or removing the
entries that don't fit, not retyping the whole list. Clear a list entirely to
fall back to the site's built-in defaults.

### Brand colors

Editors set **`primary`** (the accent, replaces the XtraPoint lime) and **`ink`**
(the dark section/header color). The hover, darker-for-text, and soft-fill shades
are **derived automatically** (`deriveSchoolTheme` in `src/data/schools.ts`).

- `secondary` (optional): a **second brand color** used for atmospheric depth —
  the hero/phone glows and the DotField gradient (buttons/links/editorial stay
  primary). **Leave it empty for single-color brands** and the page uses a
  lighter tint of the primary instead, so it still has depth. Auto-seed fills it
  from ESPN's alternate color when there's a real one.
- `onAccent` (optional): text color **on** the accent — defaults to the dark
  color; set to white for mid/dark accents like red.
- `primaryDarkOverride` (optional): only for very bright accents where the
  derived on-white shade isn't dark enough to read.

---

## The co-branded sales one-pager (PDF)

Every school also gets a **printable sales sell-sheet**, re-skinned to its brand
automatically from the same Sanity data — no manual design per school.

- **Preview in the browser:** `/schools/<slug>/one-pager` — a single US-Letter
  page with a "Download PDF" button (the button is hidden in the PDF itself).
- **Download the PDF:** `/schools/<slug>/one-pager.pdf` — generated on demand by
  a headless-Chromium serverless function that prints the page above, then
  CDN-cached (same on-demand pattern as the OG image).

It's built 1:1 from the Figma source and pulls the school **logo, brand colors,
mascot, fund, and avatar** from Sanity, so the only per-school work is what you
already do to add the school. Color roles: **primary** = eyebrows / checks /
editorial accent / phone header; **secondary** = the CTA button + chevron bullets
+ hero gradient end; a darkened primary = the dark-green sections (footer, phone
"add card"). The big faint hero **watermark uses the school's full-color avatar**
(the "App avatar" image) — set one for it to appear. Single-color schools still
look right (secondary falls back to a lighter primary tint). Type is Inter Display
+ Space Mono. The copy is static (identical for every school); to change layout or
copy, edit [`src/pages/schools/[school]/one-pager.astro`](../src/pages/schools/[school]/one-pager.astro).

> The layout is tuned to fit exactly one Letter page. If you add/lengthen copy,
> re-check `/schools/<slug>/one-pager` fits on one sheet (the CTA footer should
> sit flush at the bottom) before shipping.

## Assets

Uploaded through Sanity and served from its image CDN (`cdn.sanity.io`) — no
files go in the repo. Recommended: white/mono SVG or PNG logo that reads on
near-black; landscape photos ~1600–2048px.

## What you do NOT edit

- The page templates (`src/pages/schools/…`) and components — shared by every school.
- `src/data/schools.ts` — types + theme helpers only (no per-school data).
- The Studio schema (`studio/schemas/school.ts`) — unless you're adding a new field.

---

## Editing the legal pages (Terms & Privacy)

These aren't school pages, but they're edited the same way — in Sanity, as rich
text. In the Studio go to **Legal pages** → open **Terms & Conditions** or
**Privacy Policy** and edit the **Body**:

- Use **Heading 2** for the main sections — each becomes an entry in the page's
  sticky table of contents (and **Heading 3** for sub-sections). The contents
  list and its scroll highlighting are generated from these headings, so you never
  maintain the TOC by hand.
- Set **Last updated** when you make a substantive change.
- The two pages automatically cross-link to each other; add a third **Legal page**
  (e.g. a Cookie Policy) and it joins the nav on its own — no developer needed.

> ⚠️ **Publishing a legal page may not auto-rebuild the live site.** The
> auto-rebuild webhook is currently scoped to *school* changes. Until that's
> widened to legal pages (see HANDOFF.md), ask a developer to trigger a deploy
> after you publish legal edits. And remember this is legal copy — have it
> reviewed before it goes live.
