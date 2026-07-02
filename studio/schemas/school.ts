import { defineType, defineField } from "sanity";
import { ColorInput } from "../components/ColorInput";
import { FundInput } from "../components/FundInput";

const HEX_RULE = (r: import("sanity").StringRule) =>
  r.regex(/^#[0-9a-fA-F]{6}$/, { name: "hex color (e.g. #aaf10a)" });

// One document = one co-branded school. Mirrors the fields the Astro templates
// consume (see src/data/schools.ts `School`). The hover/darker/soft accent
// shades are DERIVED in the site from `primary` — editors only pick primary + ink.
export default defineType({
  name: "school",
  title: "School",
  type: "document",
  groups: [
    { name: "details", title: "Details", default: true },
    { name: "branding", title: "Logos & marks" },
    { name: "photos", title: "Photos" },
    { name: "theme", title: "Brand colors" },
  ],
  fields: [
    defineField({
      name: "name",
      title: "Full name",
      type: "string",
      group: "details",
      description:
        'Full legal name, e.g. "Sam Houston State University". Used in the page title, alt text, and SEO.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "short",
      title: "Short name",
      type: "string",
      group: "details",
      description:
        'Short name used in headings and the header lockup, e.g. "Sam Houston State".',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "URL slug",
      type: "slug",
      group: "details",
      description:
        'The page URL: /schools/<slug>. Click "Generate" to build it from the short name.',
      options: { source: "short", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "mascot",
      title: "Mascot (plural)",
      type: "string",
      group: "details",
      description: 'Plural mascot used throughout the copy, e.g. "Bearkats".',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "fund",
      title: "Fund name",
      type: "string",
      group: "details",
      components: { input: FundInput },
      description:
        'The fund supporters give to, e.g. "Bearkat Athletics Fund". Use “Generate” to build it from the mascot.',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "city",
      title: "City",
      type: "string",
      group: "details",
      description:
        "Not currently shown on the pages and not required — metadata only.",
    }),
    defineField({
      name: "state",
      title: "State",
      type: "string",
      group: "details",
      description:
        "Not currently shown on the pages and not required — metadata only (2-letter code, e.g. “TX”).",
    }),

    // ── Logos & marks ────────────────────────────────────────────────────────
    defineField({
      name: "logo",
      title: "Header logo (white / mono)",
      type: "image",
      group: "branding",
      options: { hotspot: true },
      description:
        "White or reversed logo — it sits on the dark header, so it must read on near-black. SVG or PNG. Leave empty to fall back to a text wordmark.",
    }),
    defineField({
      name: "logoBadge",
      title: "Put logo on a white badge",
      type: "boolean",
      group: "branding",
      description:
        "Turn ON only for a COLORED logo, so it stays visible on the dark header. Leave OFF for white/mono logos.",
      initialValue: false,
    }),
    defineField({
      name: "whiteHeader",
      title: "White header bar",
      type: "boolean",
      group: "branding",
      description:
        "Fill the top header bar white instead of dark. Use when you only have a COLORED logo (no white/mono version) so it reads against a light bar.",
      initialValue: false,
    }),
    defineField({
      name: "logoSize",
      title: "Header logo size",
      type: "string",
      group: "branding",
      description:
        "How big the logo appears in the header. Bump it up for wide crest/wordmark lockups.",
      options: {
        list: [
          { title: "Small", value: "sm" },
          { title: "Medium (default)", value: "md" },
          { title: "Large", value: "lg" },
          { title: "X-Large", value: "xl" },
        ],
        layout: "radio",
      },
      initialValue: "md",
    }),
    defineField({
      name: "mark",
      title: "App mark (single-color)",
      type: "image",
      group: "branding",
      description:
        "Optional small single-color icon (e.g. a paw) for the app-mockup avatar; it's tinted to the accent, so the file's own color doesn't matter.",
    }),
    defineField({
      name: "avatar",
      title: "App avatar (full-color)",
      type: "image",
      group: "branding",
      options: { hotspot: true },
      description:
        "Optional full-color square logo for the app-mockup avatar. Takes priority over the mark.",
    }),

    // ── Photos ────────────────────────────────────────────────────────────────
    defineField({
      name: "photos",
      title: "Photos",
      type: "object",
      group: "photos",
      description:
        "Optional game-day photography. Each is independent — the page degrades gracefully if one is missing.",
      options: { collapsible: true, collapsed: false },
      fields: [
        defineField({
          name: "team",
          title: "Team — donor hero background",
          type: "image",
          options: { hotspot: true },
        }),
        defineField({
          name: "celebrate",
          title: "Celebrate — donor spirit band",
          type: "image",
          options: { hotspot: true },
        }),
        defineField({
          name: "fans",
          title: "Fans — ambassador callout",
          type: "image",
          options: { hotspot: true },
        }),
        defineField({
          name: "action",
          title: "Action — ambassador hero background",
          type: "image",
          options: { hotspot: true },
        }),
        defineField({
          name: "mascot",
          title: "Mascot — ambassador spirit band",
          type: "image",
          options: { hotspot: true },
        }),
      ],
    }),

    // ── Brand colors ────────────────────────────────────────────────────────
    defineField({
      name: "theme",
      title: "Brand colors",
      type: "object",
      group: "theme",
      description:
        "Set the school's primary accent and dark section color. The hover, darker-for-text, and soft-fill shades are derived automatically. Leave any color empty to fall back to the standard XtraPoint brand colors.",
      options: { columns: 2 },
      fields: [
        defineField({
          name: "primary",
          title: "Primary accent",
          type: "string",
          components: { input: ColorInput },
          validation: HEX_RULE,
          description:
            "The school's main brand color (replaces the XtraPoint lime) — buttons, accents, dots. Empty → XtraPoint lime.",
        }),
        defineField({
          name: "ink",
          title: "Dark section color",
          type: "string",
          components: { input: ColorInput },
          validation: HEX_RULE,
          description:
            "Dark brand color for dark sections and the header (needs white text to read on it). Empty → XtraPoint navy.",
        }),
        defineField({
          name: "onAccent",
          title: "Text on accent (optional)",
          type: "string",
          components: { input: ColorInput },
          validation: HEX_RULE,
          description:
            "Text/icon color ON the accent (button labels). Empty → the dark color; set to white for mid/dark accents like red.",
        }),
        defineField({
          name: "primaryDarkOverride",
          title: "Dark accent for text on white (advanced)",
          type: "string",
          components: { input: ColorInput },
          validation: HEX_RULE,
          description:
            "Only if the auto-derived shade isn't dark enough to read on white (e.g. a very bright yellow/orange). Overrides the derived value.",
        }),
      ],
    }),
  ],
  preview: {
    select: { title: "name", subtitle: "mascot", media: "logo" },
  },
});
