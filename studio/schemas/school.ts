import { defineType, defineField, defineArrayMember } from "sanity";
import { ColorInput } from "../components/ColorInput";
import { FundInput } from "../components/FundInput";
import { LogoHeightInput } from "../components/LogoHeightInput";
import { PortalLinkInput } from "../components/PortalLinkInput";
import { PortalAccessInput } from "../components/PortalAccessInput";
import { ProductionStatusInput } from "../components/ProductionStatusInput";
import {
  DEFAULT_AMBASSADOR_TIERS,
  DEFAULT_AMBASSADOR_PROGRAMS,
} from "../lib/ambassadorDefaults";

const HEX_RULE = (r: import("sanity").StringRule) =>
  r.regex(/^#[0-9a-fA-F]{6}$/, { name: "hex color (e.g. #aaf10a)" });

// Shared "photo credit" field, appended to each photo below so editors can
// credit the photographer/source. Shown as a small caption on the photo.
const CREDIT_FIELD = defineField({
  name: "credit",
  title: "Photo credit",
  type: "string",
  description:
    'Photographer or source credit, e.g. "Jane Doe" or "@handle". Shown as a small caption on the photo. Leave empty to show none.',
});

// One document = one co-branded school. Mirrors the fields the Astro templates
// consume (see src/data/schools.ts `School`). The hover/darker/soft accent
// shades are DERIVED in the site from `primary` — editors only pick primary + ink.
export default defineType({
  name: "school",
  title: "School",
  type: "document",
  groups: [
    { name: "details", title: "Details", default: true },
    { name: "publishing", title: "Publishing" },
    { name: "portal", title: "Marketing portal" },
    { name: "branding", title: "Logos & marks" },
    { name: "photos", title: "Photos" },
    { name: "content", title: "Page copy & media" },
    { name: "ambassador", title: "Ambassador program" },
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

    // ── Publishing (per-school promotion to production) ─────────────────────
    // Publishing puts a school on STAGING. Production is separate and per-school:
    // it serves the `approvedVersion` snapshot taken when someone approved it, so
    // later edits appear on staging for review without touching the live site.
    defineField({
      name: "productionStatus",
      title: "Production status",
      type: "string",
      group: "publishing",
      components: { input: ProductionStatusInput },
      initialValue: "draft",
      options: {
        list: [
          { title: "Draft — staging only", value: "draft" },
          { title: "Live — approved and on xtrapoint.com", value: "live" },
        ],
        layout: "radio",
      },
      description:
        "Where this school is up to. Only Live schools appear on xtrapoint.com, and they appear exactly as they were when approved — so editing a live school is safe: the changes show on staging until someone approves them.",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "approvedVersion",
      title: "Approved snapshot",
      type: "text",
      group: "publishing",
      readOnly: true,
      hidden: true,
      description:
        "Set by Approve — the exact content production serves for this school. Not hand-edited.",
    }),
    defineField({
      name: "approvedAt",
      title: "Approved at",
      type: "datetime",
      group: "publishing",
      readOnly: true,
      hidden: true,
    }),

    // Set by the school from their portal ("Submit for review"). Deliberately a
    // SEPARATE axis from productionStatus: a school that's already live can
    // submit changes, and that must not take them off production. Lives on the
    // draft, so it arrives with the edits it refers to.
    defineField({
      name: "submittedForReview",
      title: "School has submitted changes",
      type: "boolean",
      group: "publishing",
      readOnly: true,
      initialValue: false,
      description:
        "Set by the school from their portal when they've finished editing and want you to look. Cleared when you approve.",
    }),
    defineField({
      name: "submittedAt",
      title: "Submitted at",
      type: "datetime",
      group: "publishing",
      readOnly: true,
      hidden: ({ parent }) => !(parent as { submittedForReview?: boolean })?.submittedForReview,
    }),

    // ── Marketing portal (the school's private dashboard) ───────────────────
    // Their standing hub — brand assets, live pages, one-pager, resource
    // library. Two ways in, and `portalEnabled` gates both:
    //   • Invited accounts (the normal way) — see PortalAccessInput below.
    //   • A legacy /portal/<portalToken> link, from before accounts existed.
    defineField({
      name: "portalEnabled",
      title: "Portal access",
      type: "boolean",
      group: "portal",
      initialValue: false,
      components: { input: PortalAccessInput },
      description:
        "ON: this school's portal works, for everyone invited below and for their legacy link if they have one. OFF (default): everyone gets a “this portal isn't active” notice instead — this is how you deactivate a school without removing anyone or destroying their link.",
    }),
    defineField({
      name: "portalToken",
      title: "Private portal link (legacy)",
      type: "string",
      group: "portal",
      components: { input: PortalLinkInput },
      description:
        "From before the portal had accounts: a secret URL that works for anyone who has it. Invite people above instead — it's per-person, revocable, and there's no link to leak. Keep this only for schools already using it, and Revoke once they've signed in.",
      // Only ever set by the Generate button — 32 hex chars (128 bits). Rejecting
      // anything else stops a hand-typed, guessable “token” from becoming the gate.
      validation: (r) =>
        r.regex(/^[0-9a-f]{32}$/, {
          name: "generated portal token — use the Generate button",
        }),
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

    // ── Ambassador program (all optional — defaults to the standard 3-tier
    // Bronze/Silver/Gold structure + recognition cards when left empty) ──────
    defineField({
      name: "ambassadorTiers",
      title: "Ambassador tiers",
      type: "array",
      group: "ambassador",
      description:
        "Pre-filled with the standard Bronze/Silver/Gold tiers — edit, add, remove, or reorder to customize. Clear the whole list to fall back to the site's default tiers.",
      initialValue: DEFAULT_AMBASSADOR_TIERS,
      of: [
        defineArrayMember({
          type: "object",
          name: "tier",
          fields: [
            defineField({
              name: "name",
              title: "Tier name",
              type: "string",
              description: 'e.g. "Bronze".',
              validation: (r) => r.required(),
            }),
            defineField({
              name: "role",
              title: "Subtitle",
              type: "string",
              description: 'Short descriptor under the name, e.g. "Getting started".',
            }),
            defineField({
              name: "perks",
              title: "Perks",
              type: "array",
              of: [{ type: "string" }],
              description: "One entry per perk, e.g. \"Welcome kit\".",
            }),
            defineField({
              name: "highlight",
              title: "Highlight this tier",
              type: "boolean",
              initialValue: false,
              description: "Visually features this tier (e.g. the top tier).",
            }),
          ],
          preview: {
            select: { title: "name", subtitle: "role" },
          },
        }),
      ],
      validation: (r) => r.max(6),
    }),
    defineField({
      name: "ambassadorPrograms",
      title: "Recognition & programs",
      type: "array",
      group: "ambassador",
      description:
        'Pre-filled with the standard recognition cards ("Ambassador of the Month", "Seasonal campaigns", etc.) — edit, add, remove, or reorder. Clear the whole list to fall back to the site\'s default set.',
      initialValue: DEFAULT_AMBASSADOR_PROGRAMS,
      of: [
        defineArrayMember({
          type: "object",
          name: "program",
          fields: [
            defineField({
              name: "title",
              title: "Title",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "body",
              title: "Description",
              type: "string",
            }),
          ],
          preview: {
            select: { title: "title", subtitle: "body" },
          },
        }),
      ],
      validation: (r) => r.max(8),
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
          fields: [CREDIT_FIELD],
        }),
        defineField({
          name: "celebrate",
          title: "Celebrate — donor spirit band",
          type: "image",
          options: { hotspot: true },
          fields: [CREDIT_FIELD],
        }),
        defineField({
          name: "fans",
          title: "Fans — ambassador callout",
          type: "image",
          options: { hotspot: true },
          fields: [CREDIT_FIELD],
        }),
        defineField({
          name: "action",
          title: "Action — ambassador hero background",
          type: "image",
          options: { hotspot: true },
          fields: [CREDIT_FIELD],
        }),
        defineField({
          name: "mascot",
          title: "Mascot — ambassador spirit band",
          type: "image",
          options: { hotspot: true },
          fields: [CREDIT_FIELD],
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
