import { defineType, defineField, defineArrayMember } from "sanity";

// Legal page (Terms & Conditions, Privacy Policy, …). The body is rich text
// (Portable Text) so editors write and restructure it directly in the Studio.
// The site derives the sticky table-of-contents / scrollspy from the H2/H3
// headings, and cross-links every legal page from every other one — so adding a
// third legal doc (e.g. "Cookie Policy") makes it appear in the nav with no code
// change. The slug is the URL: "terms" → /terms, "privacy-policy" → /privacy-policy.
export default defineType({
  name: "legalPage",
  title: "Legal page",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      description: 'Full page heading, e.g. "Terms & Conditions".',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "slug",
      title: "Slug (URL)",
      type: "slug",
      description:
        'The path this page lives at, off the site root. Use "terms" for /terms and "privacy-policy" for /privacy-policy. Footers link to these two slugs.',
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({
      name: "navLabel",
      title: "Short nav label",
      type: "string",
      description:
        'Short label used in the sidebar quick-links between legal pages (e.g. "Terms", "Privacy"). Falls back to the title if empty.',
    }),
    defineField({
      name: "lastUpdated",
      title: "Last updated / effective date",
      type: "date",
      description: "Shown under the page title.",
      options: { dateFormat: "MMMM D, YYYY" },
    }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      description:
        "The legal copy. Use Heading 2 for the main sections (they become the table-of-contents entries), Heading 3 for sub-sections.",
      of: [
        defineArrayMember({
          type: "block",
          // Restrict to the styles the page renders + slugs the TOC.
          styles: [
            { title: "Normal", value: "normal" },
            { title: "Heading 2", value: "h2" },
            { title: "Heading 3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          lists: [
            { title: "Bulleted", value: "bullet" },
            { title: "Numbered", value: "number" },
          ],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
            ],
            annotations: [
              {
                name: "link",
                title: "Link",
                type: "object",
                fields: [
                  {
                    name: "href",
                    title: "URL",
                    type: "url",
                    validation: (r) =>
                      r
                        .required()
                        .uri({
                          scheme: ["http", "https", "mailto", "tel"],
                          allowRelative: true,
                        }),
                  },
                ],
              },
            ],
          },
        }),
      ],
      validation: (r) => r.required(),
    }),
  ],
  preview: {
    select: { title: "title", slug: "slug.current" },
    prepare: ({ title, slug }) => ({
      title: title || "Legal page",
      subtitle: slug ? `/${slug}` : "no slug",
    }),
  },
});
