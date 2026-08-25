// What a school may change about a GENERATED template, declared once.
//
// This is the code form of the `owner: "school"` set in a template's design
// manifest (docs/CLAUDE-DESIGN-BRIEF.md). One declaration drives three things
// that would otherwise drift apart:
//
//   • the portal's editor UI      — labels, help text, control types, counters
//   • the write API's validation  — src/pages/api/portal-template.ts
//   • the renderer's merge        — src/lib/flyerContent.ts
//
// It is also the SECURITY BOUNDARY, and the rule is the same allowlist rule the
// brand editor follows (src/lib/portalEdit.ts): a field a school can change has
// to be named here. Nothing else in the template is reachable, so adding copy to
// a template later can't silently become school-editable.
//
// Values here override the derived defaults; they never replace the derivation.
// An empty or absent override falls back to what the template computes from the
// school record, which is why a school can always get back to the default by
// clearing a field rather than needing to remember what it said.

/** How the portal renders a field, and what the API accepts for it. */
export type FieldControl = "text" | "textarea" | "url" | "color" | "image" | "list";

export interface TemplateField {
  key: string;
  label: string;
  /** One line under the input. Written for a school, not for us. */
  help?: string;
  control: FieldControl;
  /** Measured against the layout — becomes the editor's character counter. */
  maxLength?: number;
  /** `list` only: caps on item count and length. */
  maxItems?: number;
  itemMaxLength?: number;
  /** Editor grouping. */
  group: string;
}

export interface TemplateSpec {
  id: string;
  title: string;
  /** Where the live preview iframe points, and what "Export" downloads. */
  previewHref: (slug: string) => string;
  exportHref: (slug: string) => string;
  groups: { id: string; title: string; blurb?: string }[];
  fields: TemplateField[];
}

const AMBASSADOR_FLYER: TemplateSpec = {
  id: "ambassador-flyer",
  title: "Ambassador flyer",
  previewHref: (slug) => `/schools/${slug}/ambassador-flyer`,
  exportHref: (slug) => `/schools/${slug}/ambassador-flyer.pdf`,
  groups: [
    {
      id: "hero",
      title: "Top of the flyer",
      blurb: "The headline students read first, and the photo behind it.",
    },
    {
      id: "body",
      title: "What you're offering",
      blurb:
        "Your rewards come from the tiers on your ambassador page — change them here only if this flyer should say something different.",
    },
    { id: "cta", title: "How they sign up", blurb: "Where the QR code sends them." },
    {
      id: "brand",
      title: "Colors for this flyer",
      blurb:
        "Leave these empty to use your brand colors. Setting one changes this flyer only — not your pages.",
    },
  ],
  fields: [
    // ── Top of the flyer ────────────────────────────────────────────────────
    {
      key: "headlineLine1",
      label: "Headline, first line",
      help: "Set in condensed caps — short lines land hardest.",
      control: "text",
      maxLength: 26,
      group: "hero",
    },
    {
      key: "headlineLine2",
      label: "Headline, second line",
      help: "Printed in your accent color.",
      control: "text",
      maxLength: 30,
      group: "hero",
    },
    {
      key: "heroSubhead",
      label: "Opening paragraph",
      control: "textarea",
      maxLength: 210,
      group: "hero",
    },
    {
      key: "heroBadge",
      label: "Badge under the paragraph",
      help: "The small pill, e.g. “Flexible schedule • All materials provided”.",
      control: "text",
      maxLength: 46,
      group: "hero",
    },
    {
      key: "heroImage",
      label: "Background photo",
      help: "A wide game-day shot. Defaults to the photos on your brand kit.",
      control: "image",
      group: "hero",
    },
    {
      key: "mark",
      label: "Logo on this flyer",
      help: "Full-color works best — it sits on a white chip. Defaults to your app avatar.",
      control: "image",
      group: "hero",
    },
    // ── Body ────────────────────────────────────────────────────────────────
    {
      key: "benefitsTitleLine1",
      label: "Benefits heading, first line",
      control: "text",
      maxLength: 24,
      group: "body",
    },
    {
      key: "benefitsTitleLine2",
      label: "Benefits heading, second line",
      control: "text",
      maxLength: 26,
      group: "body",
    },
    {
      key: "benefits",
      label: "What ambassadors get",
      help: "Three to five reads best.",
      control: "list",
      maxItems: 5,
      itemMaxLength: 62,
      group: "body",
    },
    {
      key: "rewardsTitle",
      label: "Rewards heading",
      control: "text",
      maxLength: 34,
      group: "body",
    },
    {
      key: "rewards",
      label: "Reward chips",
      help: "Taken from your ambassador tiers unless you set them here.",
      control: "list",
      maxItems: 6,
      itemMaxLength: 40,
      group: "body",
    },
    // ── CTA ─────────────────────────────────────────────────────────────────
    {
      key: "ctaTitle",
      label: "Sign-up heading",
      control: "text",
      maxLength: 34,
      group: "cta",
    },
    {
      key: "applyUrl",
      label: "Where the QR code goes",
      help: "Defaults to your ambassador page. Use a full https:// address.",
      control: "url",
      maxLength: 200,
      group: "cta",
    },
    {
      key: "contactUrl",
      label: "Contact line in the footer",
      control: "text",
      maxLength: 56,
      group: "cta",
    },
    // ── Brand ───────────────────────────────────────────────────────────────
    {
      key: "colorBase",
      label: "Dark background",
      help: "The masthead, hero and dark strip. White text sits on this.",
      control: "color",
      group: "brand",
    },
    {
      key: "colorAccent",
      label: "Highlight band",
      help: "The wide band behind “Why students are signing up”.",
      control: "color",
      group: "brand",
    },
  ],
};

export const TEMPLATE_SPECS: Record<string, TemplateSpec> = {
  "ambassador-flyer": AMBASSADOR_FLYER,
};

export const getTemplateSpec = (id: string | undefined): TemplateSpec | undefined =>
  id ? TEMPLATE_SPECS[id] : undefined;

/** The field, if this template has one by that key. Used to validate writes. */
export const getTemplateField = (
  id: string,
  key: string,
): TemplateField | undefined => TEMPLATE_SPECS[id]?.fields.find((f) => f.key === key);

/** Overrides as the renderer consumes them: scalars, lists and image URLs. */
export interface TemplateOverrides {
  values: Record<string, string>;
  lists: Record<string, string[]>;
  images: Record<string, string>;
}

export const EMPTY_OVERRIDES: TemplateOverrides = { values: {}, lists: {}, images: {} };

/** Same shape the brand editor enforces, so a template can't accept a wilder file. */
export { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, imageTypeLabel } from "@/lib/portalEdit";
