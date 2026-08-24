import { defineType, defineField, defineArrayMember } from "sanity";

// One document = one item in the Marketing Portal's resource library, and one
// detail page inside it (/portal/<token>/resources/<slug>).
//
// The unit here is the PIECE, not the file. "Announcement post" is one resource
// that ships in Canva, Figma, Illustrator and Photoshop — so a resource holds a
// LIST of formats rather than a single upload. That's the whole reason this isn't
// just a file library: a school picks the piece they want, then the tool they
// happen to own.
//
// Each format is one of three sources:
//   • File      — a .psd/.ai/.pdf/.pptx we host and they download.
//   • Link      — a Canva/Figma/Drive template they open in that tool.
//   • Generated — built per school from THEIR logo and colors by the site
//                 (see src/lib/generatedTemplates.ts). This is the only kind that
//                 needs a developer, which is why that list is short on purpose.
//
// Adding a file or a link is pure content work — no developer, no deploy.

const CATEGORIES = [
  { title: "Social media", value: "social" },
  { title: "Email", value: "email" },
  { title: "Print & signage", value: "print" },
  { title: "Event materials", value: "events" },
  { title: "Fan & parent communications", value: "comms" },
  { title: "Ambassador program", value: "ambassador" },
  { title: "Presentations", value: "presentations" },
  { title: "Fundraising campaigns", value: "fundraising" },
  { title: "Brand & guidelines", value: "brand" },
];

// The tool a format opens in. Keep in sync with PLATFORM_LABELS in
// src/data/resourcesSource.ts.
const PLATFORMS = [
  { title: "Canva", value: "canva" },
  { title: "Figma", value: "figma" },
  { title: "Illustrator", value: "illustrator" },
  { title: "Photoshop", value: "photoshop" },
  { title: "InDesign", value: "indesign" },
  { title: "Adobe Express", value: "express" },
  { title: "Google Slides", value: "googleSlides" },
  { title: "Google Docs", value: "googleDocs" },
  { title: "PowerPoint", value: "powerpoint" },
  { title: "Keynote", value: "keynote" },
  { title: "PDF", value: "pdf" },
  { title: "Image (PNG / JPG)", value: "image" },
  { title: "Video", value: "video" },
  { title: "Other", value: "other" },
];

// Keep in sync with GENERATED_TEMPLATES in src/lib/generatedTemplates.ts — the
// Studio can't import from the site, and an id with no matching registry entry
// is skipped when the portal renders.
const GENERATED_TEMPLATE_IDS = [
  { title: "Sales one-pager (PDF)", value: "one-pager" },
  { title: "Ambassador recruitment flyer (PDF)", value: "ambassador-flyer" },
];

/** Reads the enclosing formats[] item, whichever nesting Sanity hands us. */
const src = (parent: unknown): string | undefined =>
  (parent as { source?: string } | undefined)?.source;

export default defineType({
  name: "resourceTemplate",
  title: "Marketing resource",
  type: "document",
  groups: [
    { name: "details", title: "Details", default: true },
    { name: "formats", title: "Formats" },
    { name: "guide", title: "How to use it" },
  ],
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      group: "details",
      description: 'The piece, not the file — e.g. "Game-day announcement post".',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      group: "details",
      description: "The URL of this resource's page in the portal. Click Generate.",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "description",
      title: "Short description",
      type: "text",
      rows: 3,
      group: "details",
      description:
        "One or two lines, shown on the library card. Save the detail for the “How to use it” tab.",
    }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      group: "details",
      description: "Groups the resource in the portal's library.",
      options: { list: CATEGORIES },
      initialValue: "social",
      validation: (r) => r.required(),
    }),
    defineField({
      name: "thumbnail",
      title: "Preview image",
      type: "image",
      group: "details",
      options: { hotspot: true },
      description:
        "Optional but worth the minute — schools are far more likely to use a resource they can see. Upload the whole piece; the card crops it and it opens full size on click.",
    }),
    defineField({
      name: "order",
      title: "Sort order",
      type: "number",
      group: "details",
      description:
        "Optional. Lower numbers come first within a category. Ties fall back to alphabetical.",
    }),

    // ── Formats ─────────────────────────────────────────────────────────────
    defineField({
      name: "formats",
      title: "Available formats",
      type: "array",
      group: "formats",
      description:
        "Every tool this piece is available in. Add one entry per tool — a school picks whichever they already own. Order here is the order they're listed.",
      validation: (r) => r.min(1).error("Add at least one format, or the resource can't be used."),
      of: [
        defineArrayMember({
          type: "object",
          name: "format",
          fields: [
            defineField({
              name: "platform",
              title: "Tool",
              type: "string",
              options: { list: PLATFORMS },
              validation: (r) => r.required(),
            }),
            defineField({
              name: "label",
              title: "Label override",
              type: "string",
              description:
                'Optional. Only if the tool name isn\'t enough, e.g. "Canva (Instagram story)".',
            }),
            defineField({
              name: "source",
              title: "Where it comes from",
              type: "string",
              options: {
                list: [
                  { title: "File — they download it", value: "staticFile" },
                  { title: "Link — opens in the tool", value: "externalLink" },
                  { title: "Generated — built in their brand", value: "generated" },
                ],
                layout: "radio",
              },
              initialValue: "staticFile",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "file",
              title: "File",
              type: "file",
              description: "The downloadable file — .psd, .ai, .pdf, .pptx, .zip, etc.",
              hidden: ({ parent }) => src(parent) !== "staticFile",
              validation: (r) =>
                r.custom((value, ctx) =>
                  src(ctx.parent) === "staticFile" && !value
                    ? "Upload a file, or change where this format comes from."
                    : true,
                ),
            }),
            defineField({
              name: "externalUrl",
              title: "Link",
              type: "url",
              description:
                "Canva template link, Figma file, Google Drive folder. Check the sharing setting — a link that needs access approval is worse than no link.",
              hidden: ({ parent }) => src(parent) !== "externalLink",
              validation: (r) =>
                r.uri({ scheme: ["http", "https"] }).custom((value, ctx) =>
                  src(ctx.parent) === "externalLink" && !value
                    ? "Add a link, or change where this format comes from."
                    : true,
                ),
            }),
            defineField({
              name: "templateId",
              title: "Generated template",
              type: "string",
              description:
                "Built in code, so this list only grows when a developer adds one. Note: the sales one-pager already has its own page in every portal — only add it here if you want it in the library too.",
              options: { list: GENERATED_TEMPLATE_IDS },
              hidden: ({ parent }) => src(parent) !== "generated",
              validation: (r) =>
                r.custom((value, ctx) =>
                  src(ctx.parent) === "generated" && !value
                    ? "Pick a generated template, or change where this format comes from."
                    : true,
                ),
            }),
            defineField({
              name: "note",
              title: "What they'll need",
              type: "string",
              description:
                'Optional, e.g. "Requires Illustrator CC 2023+" or "Free Canva account needed".',
            }),
          ],
          preview: {
            select: {
              platform: "platform",
              label: "label",
              source: "source",
              note: "note",
              filename: "file.asset.originalFilename",
            },
            prepare: ({ platform, label, source, note, filename }) => {
              const tool = PLATFORMS.find((p) => p.value === platform)?.title ?? platform;
              const kind =
                source === "externalLink" ? "Link" : source === "generated" ? "Generated" : "File";
              return {
                title: label || tool || "New format",
                subtitle: [kind, filename, note].filter(Boolean).join(" · "),
              };
            },
          },
        }),
      ],
    }),

    // ── How to use it ───────────────────────────────────────────────────────
    defineField({
      name: "specs",
      title: "Key details",
      type: "array",
      group: "guide",
      description:
        'The quick facts, shown as a list on the resource\'s page — e.g. "Size" / "1080 × 1350", "Best for" / "Instagram feed".',
      of: [
        defineArrayMember({
          type: "object",
          name: "spec",
          fields: [
            defineField({
              name: "label",
              title: "Label",
              type: "string",
              validation: (r) => r.required(),
            }),
            defineField({
              name: "value",
              title: "Value",
              type: "string",
              validation: (r) => r.required(),
            }),
          ],
          preview: {
            select: { title: "label", subtitle: "value" },
          },
        }),
      ],
    }),
    defineField({
      name: "overview",
      title: "Overview",
      type: "array",
      group: "guide",
      description:
        "The page body: what this piece is for, when to post or print it, and anything they should know before editing. Use Heading 2 for sections.",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "Heading 2", value: "h2" },
            { title: "Heading 3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          lists: [
            { title: "Bullet", value: "bullet" },
            { title: "Numbered", value: "number" },
          ],
          marks: {
            decorators: [
              { title: "Bold", value: "strong" },
              { title: "Italic", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                type: "object",
                title: "Link",
                fields: [
                  {
                    name: "href",
                    type: "url",
                    title: "URL",
                    validation: (r: { uri: (o: object) => unknown }) =>
                      r.uri({ scheme: ["http", "https", "mailto"] }),
                  },
                ],
              },
            ],
          },
        }),
      ],
    }),
  ],
  orderings: [
    {
      title: "Category, then sort order",
      name: "categoryOrder",
      by: [
        { field: "category", direction: "asc" },
        { field: "order", direction: "asc" },
        { field: "title", direction: "asc" },
      ],
    },
  ],
  preview: {
    select: {
      title: "title",
      category: "category",
      media: "thumbnail",
      f0: "formats.0.platform",
      f1: "formats.1.platform",
      f2: "formats.2.platform",
      f3: "formats.3.platform",
    },
    prepare: ({ title, category, media, ...f }) => {
      const cat = CATEGORIES.find((c) => c.value === category)?.title ?? category;
      const tools = [f.f0, f.f1, f.f2, f.f3]
        .filter(Boolean)
        .map((p) => PLATFORMS.find((x) => x.value === p)?.title ?? p);
      const more = tools.length === 4 ? "…" : "";
      return {
        title,
        subtitle: [cat, tools.join(", ") + more].filter(Boolean).join(" · "),
        media,
      };
    },
  },
});
