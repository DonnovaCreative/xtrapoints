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
   + share image go live there first. Publishing never touches `xtrapoint.com`.
6. **Approve for production**, per school, on its **Publishing** tab. That's what
   puts it on `xtrapoint.com` — and it **freezes the content**: production serves
   the snapshot taken at approval.

### Publishing vs approving — the thing to understand

| | Where it goes | Who decides |
|---|---|---|
| **Publish** | staging | anyone editing |
| **Approve for production** | `xtrapoint.com` | per school, deliberately |

Because approving freezes a snapshot, **editing a live school is safe**. Their
changes appear on staging for review while `xtrapoint.com` carries on serving the
approved version, until someone approves again. The Publishing tab flags this:
a live school that's been edited since approval shows **"Live — changes not
approved"**.

This is also why there's no longer a "Hide from production" toggle or a global
promote. A school is on production only if its status is **Live**, and approving
one school never carries another school's half-finished edits live with it.

- **Taking a school off production:** *Take off production* on its Publishing
  tab. It stays on staging, and its snapshot is kept, so putting it back doesn't
  need re-approving content nobody changed.
- **Removing it everywhere:** **Unpublish** as usual, then use **Deploy
  production** so the removal reaches the live site.
- **Deploy production** (sidebar) is now just the plumbing — for changes not tied
  to one school (site settings, legal pages, the resource library). Approving a
  school already triggers a rebuild, so you rarely need it.

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
Image fields (`logo`, `avatar`, `photos.*`) may be **local file paths**
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
| `avatar` | image | Optional full-color square logo for the app avatar / app mockup. |
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
- **Preview image:** `/schools/<slug>/one-pager.png` — a PNG of the sheet, used
  as the thumbnail in the school's Marketing Portal. Rendered from the same page
  under print styles, so it always matches the PDF and re-renders itself when the
  school's logo or colors change. Nothing to generate by hand.

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

## The school's Marketing Portal link

Each school gets a private **dashboard** — the Marketing Portal — with a sidebar
and a page per section:

| Section | What's on it |
|---|---|
| **Overview** | Front door; links into everything below |
| **Your pages** | Their donor + ambassador page URLs, with copy buttons |
| **Sales one-pager** | Preview + PDF download of their co-branded sell sheet |
| **Resource library** | The shared template catalog, and a page per template |
| **Brand kit** | Their logo files and color hexes |

Everything except the resource library is generated from the same Sanity school
document, so there's nothing extra to maintain per school.

Access is by **invitation**: you invite a school's contact by email from the
Studio, and they get an account. (A school onboarded before accounts existed may
still be using a secret link — see the legacy note below.)

### Turning a school on — the whole checklist

Everything happens in the Studio. No terminal, no Clerk dashboard.

1. **Create and publish the school** (paths above). You can invite them before
   it's approved for production — in fact that's the point: the portal is where
   they get their page right before it goes live.
2. Open the school's **Marketing portal** tab.
3. Turn **Portal access** on.
4. Under **Who can open this portal**, type their contact's email and hit
   **Send invite**. Repeat for as many people as you like.

That's it. They get an email that creates their account and drops them straight
into their portal — there's no link for you to copy and nothing for them to set
up. Their organization is created automatically by the first invite.

The panel shows who's **Active** (signed in) and who's still **Invited**, and
lets you cancel an invitation or remove someone.

### Switching a school off

Turn **Portal access** off. Everyone — accounts and legacy links alike — gets a
"this portal isn't active" notice, and turning it back on restores everything
exactly as it was. That's the deactivation switch; it doesn't delete anything.

To remove one *person* rather than the whole school, use **Remove** next to their
name.

### Two things that trip people up

- **Publish first.** Invitations are refused for an unpublished school — there'd
  be no pages to show them. The panel says so if you try. The school does *not*
  need to be approved for production: before it's live, the portal links them to
  the staging previews and labels them **Preview**, so they can see their pages
  while they're still being built.
- **Staging and production have separate accounts.** Sanity content is shared
  between them, but the account system is not: an invite sent from the staging
  Studio creates an account that only exists on staging. Schools should be
  invited from the **production** Studio; use staging invites for testing only.

### The legacy "Private portal link"

Before accounts existed, each school got a secret URL (`/portal/<token>`) that
worked for anyone holding it. Those still work, and **Portal access** still
switches them off — but don't hand out new ones. Invitations are better in every
way that matters: per-person, revocable individually, and nothing to leak. Once a
school's people have signed in, hit **Revoke** on their old link.

### What a school can change themselves

On their **Brand kit** page, an invited school can replace their logo and app
avatar, set their brand colors, and upload the five page photos — each with an
optional **photo credit**, the same as in the Studio.

**Their edits go to the Sanity draft, never straight to a live page.** So the
review flow is the one you already use:

1. School edits in the portal → it becomes an **unpublished change** on their
   school document
2. They hit **Submit for review** → the Publishing tab shows *"School has
   submitted changes"*
3. You review the draft (**Open preview** renders it), then **Publish** → staging
4. **Approve for production** when you're happy → `xtrapoint.com`

Deliberately **not** editable by schools: page copy, their slug, ambassador
tiers, portal access, and anything to do with production status — a school can't
publish itself live. Those stay in the Studio. `primaryDarkOverride` is also
ours, since getting it wrong makes text unreadable rather than merely off-brand.

Requires `SANITY_WRITE_TOKEN` (see `.env.example`).

### XtraPoint staff

Staff belong to one organization flagged as staff, which has no school of its own
and can open **every** school's portal — with an amber "Staff view" bar so it's
obvious whose portal you're looking at. That flag is set from the terminal
(`node scripts/clerk-orgs.mjs <org> --staff`) precisely because it's the widest
access in the system and shouldn't be a click away in the CMS.

## The resource library (Marketing Resources)

The portal carries a **shared library** of XtraPoint-made materials — the same
catalog for every school, edited under **Marketing Resources** in the Studio.
Nothing here is per-school, so adding an item publishes it to every school's
portal at once.

**One resource = one piece, not one file.** "Announcement post" is a single
resource that ships in Canva, Figma, Illustrator and Photoshop — a school picks
the piece they want, then the tool they happen to own. Each resource also gets
its **own page** in the portal, so there's room to explain how to use it.

### The three tabs

**Details** — title, slug (click Generate; it's the page's URL), short
description for the card, category, preview image, sort order.

**Formats** — one entry per tool. Each is a **Tool** (Canva, Figma, Photoshop, …)
plus where it comes from:

| Where it comes from | What the button does | Who can add it |
|---|---|---|
| **File** | Downloads the file we host | Anyone with Studio access |
| **Link** | Opens in Canva / Figma / Drive | Anyone with Studio access |
| **Generated** | Builds it in *their* logo and colors | Developer — needs code |

Files and links are pure content: upload or paste, publish, done. Only
**Generated** needs a developer, because each one is a real code template (see
`src/lib/generatedTemplates.ts` — the sales one-pager is the first). That's the
intended split: grow the library freely with files and links, and add generated
templates deliberately.

**How to use it** — the resource's page body. **Key details** is the quick-facts
list (e.g. "Size" / "1080 × 1350", "Best for" / "Instagram feed"); **Overview**
is the write-up: what it's for, when to post or print it, what to change and what
to leave alone. Both are optional — with neither, the page still lists the
formats.

### Practical notes

- **Add a preview image.** Schools are far more likely to use something they can
  see, and it's clickable — it opens full size, so they can tell what a piece is
  without downloading it first. Upload the whole piece rather than a detail: the
  card crops it to a tidy thumbnail, and the full-screen view is where it's judged.
- **Generated formats get their preview automatically** — rendered from the
  template in that school's own brand, so there's nothing to upload and it can't
  go stale. Uploading a preview image overrides it.
- For links, check the sharing setting — a Canva link that requires access
  approval is worse than no link.
- Use **Category** to group items; the portal renders them under those headings.
  **Sort order** controls position within a category (lower first).
- A resource with **no usable format** is hidden rather than shown as a dead end,
  and the library page shows a "request a template" prompt when it's empty — so
  schools never land on a bare shelf.

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
