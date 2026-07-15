import { defineType, defineField } from "sanity";
import { ColorInput } from "../components/ColorInput";
import { FundInput } from "../components/FundInput";
import { LogoHeightInput } from "../components/LogoHeightInput";

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
    { name: "content", title: "Page copy & media" },
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
      name: "fundShort",
      title: "Fund / collective short name",
      type: "string",
      group: "details",
      description:
        'Optional. A short brand name for the giving collective, e.g. "KatFund". When set, it\'s used in the copy ("give through KatFund", "Become a KatFund Ambassador", "approved by KatFund"). Leave empty to use the school + fund names as normal.',
    }),
    defineField({
      name: "beneficiary",
      title: "Who supporters help",
      type: "string",
      group: "details",
      description:
        'Optional. Short phrase for who donations support, e.g. "Bearkat Athletes". Drop the "the" if it reads as a name. Leave empty to default to "the <Mascot>".',
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

    // ── Page copy & media (all optional — strong defaults render when empty) ──
    defineField({
      name: "whyGiveHeading",
      title: "“Why give” heading (custom)",
      type: "string",
      group: "content",
      description:
        'Optional. Overrides the heading of the "Why round up" section. Only used if you also fill in the custom body below.',
    }),
    defineField({
      name: "whyGiveBody",
      title: "“Why give” body (custom)",
      type: "text",
      rows: 6,
      group: "content",
      description:
        "Optional. The fund's own pitch for why supporters should give. When set, it replaces the default value-prop cards in the “Why round up” section. One paragraph per blank line. Leave empty to use the standard donor-focused default.",
    }),
    defineField({
      name: "videoUrl",
      title: "Explainer video URL",
      type: "url",
      group: "content",
      description:
        "Optional. A short video for THIS school (YouTube, Vimeo, or an MP4) — e.g. a testimonial. Overrides the site-wide default explainer (set under Site settings). Leave empty to use the default.",
      validation: (r) => r.uri({ scheme: ["http", "https"] }),
    }),
    defineField({
      name: "videoHeading",
      title: "Video heading",
      type: "string",
      group: "content",
      description:
        'Optional. Heading above the video. Defaults to "See how round-up giving works". Set it to match a custom video (e.g. "Hear from the Bearkats").',
    }),
    defineField({
      name: "videoCaption",
      title: "Video caption",
      type: "string",
      group: "content",
      description:
        "Optional. One line under the heading. Defaults to a short explainer line; set it to match a custom video.",
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
      name: "logoLockup",
      title: "Show school name next to logo",
      type: "boolean",
      group: "branding",
      description:
        "Lock the school's short name up as text beside the logo in the header. Turn ON when the logo is small or square (common for high schools) and reads poorly on its own.",
      initialValue: false,
    }),
    defineField({
      name: "logoSize",
      title: "Header logo size",
      type: "string",
      group: "branding",
      description:
        "How tall the logo appears in the header. Pick a preset, or choose Custom for a slider. The header bar is 68px by default, so larger logos extend beyond it — turn on “Header hugs the logo” below to grow the bar to fit.",
      options: {
        list: [
          { title: "Small — 24px", value: "sm" },
          { title: "Medium — 28px (default)", value: "md" },
          { title: "Large — 40px", value: "lg" },
          { title: "X-Large — 56px", value: "xl" },
          { title: "2X-Large — 80px", value: "2xl" },
          { title: "Custom (slider) —", value: "custom" },
        ],
        layout: "radio",
      },
      initialValue: "md",
    }),
    defineField({
      name: "logoHeight",
      title: "Custom logo height",
      type: "number",
      group: "branding",
      components: { input: LogoHeightInput },
      description: "Drag to set the logo height, 24–120px.",
      initialValue: 40,
      validation: (r) => r.min(24).max(120),
      hidden: ({ document }) => (document?.logoSize ?? "md") !== "custom",
    }),
    defineField({
      name: "headerHug",
      title: "Header hugs the logo",
      type: "boolean",
      group: "branding",
      description:
        "OFF (default): the header is a fixed 68px bar and the logo sits inside it. ON: the header has no fixed height and grows to fit the logo — best for tall crest/wordmark lockups.",
      initialValue: false,
    }),
    defineField({
      name: "headerPadding",
      title: "Add padding around the logo",
      type: "boolean",
      group: "branding",
      description:
        "Only when “Header hugs the logo” is on. ON (default): adds standard space above/below the logo. Turn OFF when the logo file already has its own margin baked in, so the header sits tight to it.",
      initialValue: true,
      hidden: ({ document }) => !document?.headerHug,
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
          name: "secondary",
          title: "Secondary accent (optional)",
          type: "string",
          components: { input: ColorInput },
          validation: HEX_RULE,
          description:
            "A second brand color, used for atmospheric depth (glows, gradients, soft accents) alongside the primary. Leave empty for single-color brands — the page uses a lighter tint of the primary instead.",
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
