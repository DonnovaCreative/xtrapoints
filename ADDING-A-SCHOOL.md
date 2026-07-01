# Adding a co-branded school landing page

Everything for the `/schools/<slug>` pages is driven by **one file**:
[`src/data/schools.ts`](src/data/schools.ts). Add one entry to the `schools`
array and you automatically get **two pages**, fully re-skinned to that school:

- `/schools/<slug>` — the **donor** landing page (waitlist)
- `/schools/<slug>/ambassadors` — the **ambassador** program page

No new components, routes, or CSS. The shared template
(`src/pages/schools/[school].astro` + `…/[school]/ambassadors.astro`) reads each
field below and the design language re-colors itself to the school.

---

## The fields (your "props")

Each object in `schools` matches the `School` interface. Required unless noted.

| Field | Example | Controls / where it shows |
| --- | --- | --- |
| `slug` | `"sam-houston"` | The URL: `/schools/sam-houston`. Lowercase, hyphenated. Also the assets folder name. |
| `name` | `"Sam Houston State University"` | Full legal name — `alt` text, SEO `<title>`/description. |
| `short` | `"Sam Houston State"` | Short name used in headings/copy and the header lockup. |
| `mascot` | `"Bearkats"` | Plural mascot — used all over the copy ("back the Bearkats"). |
| `fund` | `"Bearkat Athletics Fund"` | The fund supporters give to — phone mockup, headings, form tags. |
| `city` / `state` | `"Huntsville"` / `"TX"` | Metadata (not heavily shown yet; keep accurate). |
| `logo?` | `/assets/schools/<slug>/logo-white.png` | **Optional.** Logo in the dark header next to the XtraPoint mark. Use a **white/reversed** version so it reads on the navy. **Omit → a styled text wordmark is used.** |
| `logoBadge?` | `true` | **Optional.** Set for a **colored** logo (e.g. dark-maned) → renders it on a white badge so it stays visible on the dark header. Omit for white/mono logos. |
| `logoClass?` | `"h-10 w-auto"` | **Optional.** Header logo sizing. Default `"h-7 w-auto"` — bump it for wide crest/wordmark lockups. |
| `mark?` | `/assets/schools/<slug>/paw.svg` | **Optional.** Small **single-color** icon (e.g. a paw) for the app-mockup avatar, tinted to the accent. **Omit → a letter monogram (first letter of `fund`).** |
| `avatar?` | `/assets/schools/<slug>/avatar.png` | **Optional.** **Full-color** square logo for the app-mockup avatar. Takes priority over `mark`. |
| `photos?` | object, see below | **Optional.** Real game-day photography. Each is independent and **degrades gracefully if missing.** |
| `theme` | object, see below | The 5 brand colors. Required. |

### `photos` (all optional)

| Key | Where it appears | If omitted |
| --- | --- | --- |
| `team` | Ghosted behind the **donor hero** | Hero shows just the dot field |
| `celebrate` | Full-bleed **spirit band** on the donor page | Band is hidden |
| `fans` | Framed photo in the **"Become an Ambassador"** callout | Falls back to Bronze/Silver/Gold tiles |
| `action` | Ghosted behind the **ambassador hero** | Hero shows just the dot field |
| `mascot` | Full-bleed **spirit band** on the ambassador page | Band is hidden |

### `theme` — the 5 colors

The whole design uses one accent + one dark. These map onto the global tokens
per page (see `schoolThemeVars`), so buttons, the handwritten accent words, the
dot field, chips, etc. all re-color at once.

| Field | What it is | Tip |
| --- | --- | --- |
| `primary` | The school's main brand color (replaces XtraPoint lime) — buttons, accents, dots | Use the official hex. |
| `primaryDeep` | Hover/pressed shade | ~10% darker than `primary`. |
| `primaryDark` | Accent color for **text/icons on white** | ⚠️ Must be dark enough to read on white. For bright accents (yellow/light orange) go noticeably darker. |
| `primarySoft` | Translucent fill for soft chip backgrounds | `rgba(<primary>, 0.12)` — there's a `hexToRgba(hex, 0.12)` helper if you'd rather compute it. |
| `ink` | Dark section background | A dark brand color, or a dark neutral. Needs white text to be legible on it. |
| `onAccent?` | **Optional.** Text/icon color **on** the accent (button labels) | Defaults to `ink` (dark text — right for bright accents like lime/orange). For a **mid/dark accent like red**, set `onAccent: "#ffffff"` so labels stay legible. |

---

## Where assets go

Put everything in **`public/assets/schools/<slug>/`** and reference it as
`/assets/schools/<slug>/<file>` (the `public/` prefix is dropped in the URL).

| Asset | Recommended | Notes |
| --- | --- | --- |
| `logo-white.svg` | White/light SVG | It sits on the dark header — must read on near-black. |
| `paw.svg` (mark) | Single-color SVG using `fill="currentColor"` | It's tinted to the accent via CSS mask, so the file's own color doesn't matter. |
| Photos | `.jpg`/`.webp`, ~1600–2048px wide, < ~400 KB | Landscape works best; they're used as wide backgrounds. They lazy-load. |

---

## Step-by-step: add a new school

1. **Create the assets folder:** `public/assets/schools/<slug>/` and drop in the
   logo, mark, and any photos.
2. **Get the brand colors** (school athletics brand guide, or sample the hex from
   the logo/uniforms). You need `primary`, a deep + dark variant, and `ink`.
3. **Add one entry** to the `schools` array in `src/data/schools.ts` (template
   below).
4. **Run it:** `npm run dev` → visit `/schools/<slug>` and `/schools/<slug>/ambassadors`.
5. **Build to confirm:** `npm run build` (the source of truth for "is it broken").

### Copy-paste template

```ts
{
  slug: "new-school",
  name: "New School University",
  short: "New School",
  mascot: "Mascots",
  fund: "Mascot Athletics Fund",
  city: "City",
  state: "ST",
  logo: "/assets/schools/new-school/logo-white.svg", // optional
  mark: "/assets/schools/new-school/paw.svg",         // optional
  photos: {                                            // all optional
    team: "/assets/schools/new-school/team.jpg",
    fans: "/assets/schools/new-school/fans.jpg",
    celebrate: "/assets/schools/new-school/celebrate.jpg",
    mascot: "/assets/schools/new-school/mascot.jpg",
    action: "/assets/schools/new-school/action.jpg",
  },
  theme: {
    primary: "#0033A0",      // school primary
    primaryDeep: "#002D8A",  // ~10% darker
    primaryDark: "#002472",  // dark enough for text on white
    primarySoft: "rgba(0, 51, 160, 0.12)",
    ink: "#101418",          // dark sections
  },
},
```

The bare minimum (no assets yet) is `slug`, `name`, `short`, `mascot`, `fund`,
`city`, `state`, and `theme` — the page still renders with the wordmark, a
monogram, and dot-field-only heroes.

---

## Social share image (auto-generated)

Each school automatically gets a **1200×630 Open Graph card** at
`/schools/<slug>/og.png`, wired into both pages' `<head>` (`og:image` /
`twitter:image`). It's rendered at **build time** from the registry entry —
dark `ink` background, the XtraPoint × school logo lockup, and the Anton +
Permanent Marker headline in the school's `primary` color, mirroring the donor
hero. **No action needed per school** — it just works from `logo` + `theme`.

- Generator: [`src/og/renderSchoolOg.ts`](src/og/renderSchoolOg.ts)
  (satori → SVG, `@resvg/resvg-js` → PNG). Fonts bundled in `src/og/fonts/`.
- Endpoint: [`src/pages/schools/[school]/og.png.ts`](src/pages/schools/[school]/og.png.ts).
- To preview a card, run `npm run build` and open `dist/schools/<slug>/og.png`,
  or paste the live URL into a social-card validator.
- `logo` (a white/mono SVG or PNG) makes the best lockup; `logoBadge: true`
  puts a colored logo on a white chip, same as the header.

## What you do NOT edit

- The page templates (`src/pages/schools/…`) — shared by every school.
- The components (`SchoolHeader`, `SchoolPhone`, `SchoolPhotoBand`) — generic.
- The forms — the donor waitlist and ambassador waitlist are wired in already.
  (Submission routing/inboxes are a Web3Forms key concern, not per-school.)
