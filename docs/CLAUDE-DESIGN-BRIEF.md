# Designing portal templates in Claude Design

Marketing templates for the portal are designed in **Claude Design** and ported
into the site as *generated* resources — a per-school Astro page that headless
Chromium prints to PDF/PNG (see HANDOFF.md, "Ambassador flyer"). The port is
mechanical **only if the export carries the designer's intent**, not just the
pixels.

The first one (`Ambassador Flyer.dc.html` → `AmbassadorFlyerView.astro`) cost far
more than transcription, and almost none of that was the layout. It was
reconstructing decisions the export didn't record:

| What the export gave | What it didn't, and what that cost |
|---|---|
| 18 copy fields with measured `maxLength`s — genuinely good | Every one marked **required, no default**. A new school couldn't render until someone wrote 18 strings, which defeats the point. I wrote the defaults. |
| `theme.primary` / `theme.accent` as hex values | No record of *what each color sits on*. The accent is a text color on the dark field, a background with dark text on it, AND a bullet on the bare white sheet. Missing that third use shipped an invisible white-on-white band for one school and a grayscale flyer for another. |
| An `assets` object | Three different lifecycles in one bag — per-school (`collectiveLogo`, `heroImage`), platform assets we already have (`xtrapointLogo`, fonts), and one that should be **generated at render** (`qrCode`). |
| `mascotPrimary` marked **required** | No school has one. No declared behaviour when absent, so I invented "widen the headline into the space". |
| A hero photo | No aspect ratio, and drawn as a second background layer under a scrim. Chromium flattens that into a bitmap at source resolution — the PDF came out at **6MB** until I cropped server-side to the band's real 3.26:1. |

Paste the brief below at the **start** of a Claude Design session. It's written to
be design-agnostic — it constrains how the piece is *specified*, not how it looks.

---

## The brief (copy from here)

> You are designing a print/marketing template for XtraPoint. It will not be
> exported as a flat file — it gets ported into an Astro component and rendered
> **per school** by headless Chromium, re-skinned from each school's brand data.
> Roughly 15 schools today, growing. Design it however it should look, but
> specify it to the rules below, because they're what make the port mechanical.
>
> ### 0. Two audiences, and why that shapes the spec
> Where this is heading: schools get a **Marketing Portal** that works the way
> your own tweak panel does — they open a generated piece and change the parts
> that are theirs. A different logo, their own hero image, reworded copy, a QR
> pointing somewhere else. So the template has two jobs at once:
>
> 1. **Render correctly for a school that has touched nothing.** Day one, every
>    school gets this piece with zero authoring.
> 2. **Survive being edited.** Anything you mark editable *will* be changed, so
>    the layout has to hold across the whole range you allow — not just at your
>    default. A three-item list must look deliberate if you permit three.
>
> Your manifest is what builds that editor. The `maxLength` you measure becomes a
> live character counter; a list's `min`/`max` becomes its add/remove limits; a
> variable you mark editable becomes a field in their portal, and one you don't
> is locked. Specify accordingly — this is the spec for a UI, not just notes for
> a developer.
>
> ### 1. One root, fixed size, print-safe
> - Wrap the whole piece in a **single root element** with a stable class
>   (`.xp-sheet`). Nothing that should print may live outside it. It gets
>   screenshotted by that selector.
> - State the sheet size explicitly and set `@page { size: …; margin: 0 }`.
> - **Keep fills opaque.** Chromium exports element `opacity` and
>   fade-to-transparent gradients as PDF soft-masks that macOS Preview silently
>   drops. A solid gradient between two opaque colors is fine; a stop at
>   `transparent` is not. Never use `opacity` on a printing element — use a solid
>   blend of the color instead.
> - Texture and icons must be **inline SVG**, never a raster image or a CSS
>   gradient pattern — those rasterize and go blurry in print.
>
> ### 2. Color: declare ROLES and what each one SITS ON
> This is the part that breaks if you skip it. Do not think in "primary and
> secondary". Think in roles, and for every role record **its background** and
> **what it has to carry**, because a school's colors get fitted to those roles by
> measured contrast — a school whose primary is bright orange or mid-tone red gets
> a completely different assignment than the one you designed with.
>
> Use a CSS custom property per role, all defined once on the root, and use
> nothing but those vars in the design body. Assume the values will be replaced
> wholesale.
>
> Typical roles — rename as your design needs, but keep the *shape*:
> - `--base` — the dark field. Carries white body copy.
> - `--base-deep` — a deeper shade of it, for a second dark band.
> - `--accent` — the light band. Carries `--base`-colored copy **on** it.
> - `--accent-ink` — small body copy sitting on `--accent`.
> - `--mark` — **any accent-colored element that sits on the bare white sheet**
>   (bullets, a CTA button, a rule). Keep this separate from `--accent` even if
>   you're using the same value, because the two have different obligations and a
>   pale accent that reads fine on the dark field disappears on white.
> - `--on-mark` — text/icons on `--mark`.
>
> For each role, tell me in the manifest: what it sits on, what sits on it, and
> whether that text is small (needs 4.5:1) or display-size (3:1 is fine).
>
> **Do not put derived shades in the payload.** If a value is
> "the base darkened 35%" or "the base at 94% alpha", say so — it gets computed,
> not supplied.
>
> ### 3. Content: every variable has a default AND an owner
> - Every string a school could change is a named variable.
> - **Write a default for every one of them** that renders correctly with zero
>   authoring. This is the single most important rule here.
> - Tag every variable with an **`owner`**, because that decides where its value
>   comes from and whether it appears in the school's editor:
>   - **`derived`** — computed from data the school already has. Name the exact
>     source field from the dictionary below (`"source": "school.beneficiary"`).
>     Prefer this whenever a real field fits; it's the only kind that's correct
>     automatically. Lists can derive too — the ambassador flyer's reward chips
>     come from `ambassadorTiers[].perks`.
>   - **`school`** — a school should be able to change this in their portal.
>     This is the biggest bucket and the point of the whole exercise. Give it a
>     **`control`**: `text`, `textarea`, `color`, `image`, `url`, `list<text>`,
>     `list<object>`. Add a short `label` and `help` string — those are the field
>     label and hint a school actually reads.
>   - **`fixed`** — XtraPoint's copy, not theirs to edit: legal disclaimers,
>     compliance language, claims about the platform.
> - **Invented placeholders are fine, but only inside `school`-owned defaults.**
>   If your piece wants a price, a headcount, or a contact name, that's allowed —
>   mark it `owner: "school"` with a control, and write a default that reads as an
>   obvious blank (`"Contact us"`, `"—"`), **never a literal `{token}`**, because
>   an unedited school prints exactly what the default says. Do NOT invent a
>   `derived` source; `derived` may only reference the dictionary.
> - Give each string a `maxLength` **measured against your layout**, not guessed.
> - Split any heading that needs a line break into `…Line1` / `…Line2`; the `<br>`
>   lives in the markup. Copy must never contain HTML.
> - Repeating groups (bullets, chips, tiles) are arrays — state min and max count
>   and what happens outside that range.
> - Give me one escape hatch for long copy (e.g. "drop the h1 from 37pt to 33pt
>   when either line exceeds 26 characters") and note where the layout has slack.
>   **Wire it in the artboard** — a rule that only exists in the manifest is dead
>   on arrival, and any size it names must match the value the design actually
>   uses.
>
> ### 3a. The data dictionary — what `derived` may reference
> This is everything a school record holds today. `derived` variables may use
> **only** these. Anything else is `school` or `fixed`.
>
> **Always present:** `slug`, `name` ("Sam Houston State University"), `short`
> ("Sam Houston State"), `mascot` (plural — "Bearkats"), `fund`
> ("Bearkat Athletics Fund"), `city`, `state`, `beneficiary` (who supporters
> help — "Bearkat Athletes"), `programName` (the ambassador program's name — the
> collective if set, else `short`), `approver`, `givingDest`, `theme`.
>
> **Optional — always give the layout an absent path:** `collective` (a fund's
> own brand, e.g. "KatFund"), `whyGiveHeading`, `whyGiveBody`, `videoUrl`,
> `videoHeading`, `videoCaption`, `logo` (**white/mono cut, for dark
> backgrounds**), `logoBadge` (true = `logo` is full-color), `avatar`
> (full-color square mark), `photos.{team,fans,celebrate,action,mascot}` (game-day
> photography, each independent), `photos.{cutout,cutoutSecondary}` (pre-masked
> transparent mascot PNGs), `ambassadorTiers[]` (`{name, role?, perks?[],
> highlight?}`), `ambassadorPrograms[]` (`{title, body?}`).
>
> **Colors —** `theme.primary`, `theme.secondary`, `theme.hasSecondary` (false
> means `secondary` is just a tint of primary, not a real brand color),
> `theme.ink` (their dark color). Everything else is derived at render, so never
> ask for a shade: request roles per §2 and they get fitted by measured contrast.
>
> **Platform constants** (not per-school): the XtraPoint name, domain, logo marks,
> and support URL.
>
> Note what is NOT here: no prices, no headcounts, no per-school contact person,
> no season label, no social handles. Those are all legitimate — they're just
> `school`-owned, not `derived`.
>
> ### 4. Assets: classify by lifecycle, and declare the absent state
> Sort every image into exactly one of:
> - **platform** — XtraPoint's own marks and fonts. Name them; we already host them.
> - **school** — supplied per school.
> - **generated** — made at render time (QR codes especially). Never embed a QR
>   image; mark the slot and say what URL it encodes.
>
> For every **school** asset give me: the box it fills in px, its aspect ratio,
> whether it needs transparency, its focal point as 0–1 fractions if it's cropped,
> and — required — **what the layout does when it's missing**. Assume most schools
> will be missing most of them on day one. "Required" is not an option; if the
> design collapses without it, say what it collapses to.
>
> A photograph under a scrim must be **its own element** with the scrim as a
> sibling overlay — never two layers of one `background-image` — and tell me the
> band's aspect ratio so it can be cropped server-side.
>
> ### 5. Type
> Prefer fonts already in the project: **Inter Display**, **Space Mono**,
> **Archivo** (variable, `wdth` 62–125). If the design needs another, say so
> loudly, include the `.woff2`, and list every axis setting you used — a variable
> axis like condensed `wdth` reflows the whole headline if it's lost, so it can't
> be guessed from a screenshot.
>
> ### 6. Export a manifest next to the design
> Alongside the artboard, write `template.manifest.json`:
>
> ```json
> {
>   "id": "ambassador-flyer",
>   "title": "Ambassador recruitment flyer",
>   "sheet": { "width": "8.5in", "height": "11in", "root": ".xp-sheet" },
>   "fonts": [{ "family": "Archivo", "file": "Archivo.woff2",
>               "variable": true, "axes": { "wdth": 62, "wght": 800 } }],
>   "colorRoles": [
>     { "var": "--accent", "designValue": "#EEB211",
>       "sitsOn": "white sheet + --base",
>       "carries": [{ "what": "--base display copy", "size": "display", "min": 3 },
>                   { "what": "--base label copy", "size": "small", "min": 4.5 }] }
>   ],
>   "derived": { "--base-deep": "darken(--base, 0.35)",
>                "--scrim-top": "rgba(--base, 0.94)" },
>   "copy": [
>     { "key": "headlineLine1", "default": "Don't just be a fan.", "maxLength": 26,
>       "owner": "school", "control": "text",
>       "label": "Headline, first line",
>       "help": "Keep it short — it's set in condensed caps at 37pt." },
>
>     { "key": "programName", "owner": "derived", "source": "school.programName",
>       "note": "the collective's name if they have one, else the school's short name" },
>
>     { "key": "disclaimer", "owner": "fixed",
>       "default": "Rewards are subject to eligibility and official program terms.",
>       "maxLength": 200 },
>
>     { "key": "contactEmail", "owner": "school", "control": "text",
>       "default": "Contact us", "maxLength": 40,
>       "label": "Contact shown in the footer",
>       "note": "no such field exists yet — an unedited school prints the default verbatim, so the default must read as finished copy, not a placeholder token" }
>   ],
>   "lists": [
>     { "key": "benefits", "min": 3, "max": 5, "itemMaxLength": 62,
>       "owner": "school", "control": "list<text>",
>       "label": "What ambassadors get",
>       "default": ["…"], "overflow": "drop items past 5",
>       "underflow": "below 3 the column looks thin; raise item gap to 0.09in" },
>
>     { "key": "rewards", "owner": "derived",
>       "source": "school.ambassadorTiers[].perks",
>       "fallback": "if fewer than 3 unique perks, use the default list",
>       "min": 3, "max": 6, "itemMaxLength": 40, "default": ["…"] }
>   ],
>   "assets": [
>     { "key": "heroImage", "kind": "school", "control": "image",
>       "label": "Hero photograph", "box": [816, 250], "aspect": 3.26,
>       "focal": [0.5, 0.62], "transparent": false, "ownLayer": true,
>       "absent": "band falls back to solid --base; scrim still applies" },
>     { "key": "mascotCutout", "kind": "school", "box": [296, 319],
>       "transparent": "required — pre-masked PNG, alpha channel",
>       "absent": "slot collapses; hero copy widens from 5.35in to 6.6in" }
>   ],
>   "generated": [{ "key": "qr", "encodes": "applyUrl", "box": [134, 134] }],
>   "escapeHatches": [
>     { "when": "headline line > 26 chars", "do": "--h1 37pt → 33pt" }
>   ]
> }
> ```
>
> Keep the design body free of literal per-school values — no school name, no
> brand hex, no uploaded photo path outside the vars and the manifest.

## Why `owner` matters more than it looks

Sanity is the tool XtraPoint staff use to stand a school up, and it should stay
small — the fields needed to launch, not a home for every string on every piece.
The **portal** is where a school edits their own materials, the way Claude
Design's tweak panel works: swap the logo, change the hero, reword a section,
point the QR somewhere else.

So "this variable has no Sanity field" is not a defect. It means the variable is
**school-owned**, and it needs a default that reads as finished copy plus a
control in the portal. The only hard rule is that `derived` may not reference a
field that doesn't exist — a `derived` variable with no source prints its own
placeholder token onto the sheet.

That makes the manifest do triple duty:

| Manifest field | What it becomes |
|---|---|
| `default` | the template's zero-authoring render |
| `owner: derived` + `source` | a read straight from the school record |
| `owner: school` + `control`/`label`/`help` | a field in the portal's editor |
| `maxLength`, list `min`/`max` | live character counters and add/remove limits |
| the set of `owner: school` keys | the per-template **allowlist** — the same security boundary `src/lib/portalEdit.ts` already enforces for brand editing, extended per template rather than hand-maintained |
| `escapeHatches`, `slack` | what keeps the layout intact when they overrun |

## What still needs a developer

Even a perfect export doesn't self-install. Per template, expect:

- an Astro view component + three routes (page, `.pdf.ts`, `.png.ts`) — copy the
  ambassador flyer's and swap the body
- a registry entry in `src/lib/generatedTemplates.ts` **and** in
  `GENERATED_TEMPLATE_IDS` in `studio/schemas/resourceTemplate.ts`
- a content module (like `src/lib/flyerContent.ts`) holding the defaults and the
  `derived` reads
- the Marketing Resource document in the Studio

**Not yet built:** the per-school override store and the portal editor the
`owner: school` variables imply. Until that exists, school-owned variables render
their defaults — which is exactly why the defaults must be finished copy. The
manifests accumulated between now and then are the spec for building it.

The brief's job is to delete the *translation* work — the color-role archaeology,
the invented fallbacks, the copy defaults, the print gotchas. That was the
expensive part, not the wiring.
