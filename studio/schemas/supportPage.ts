import { defineType, defineField, defineArrayMember } from "sanity";

// Customer Support page singleton (one document, id "supportPage"). Unlike the
// legal documents, Support keeps its own bespoke layout on the site (a structured
// contact card + numbered sections). So the contact details are structured fields
// (email / hours / address → the card) and everything below is rich text so the
// team can restructure the sections without touching code. Rendered by
// src/pages/support.astro (NOT the shared legal template).
export default defineType({
  name: "supportPage",
  title: "Customer Support",
  type: "document",
  fields: [
    defineField({
      name: "title",
      title: "Page title",
      type: "string",
      description: 'The H1 at the top of the page. Usually "Customer Support".',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "intro",
      title: "Intro line",
      type: "text",
      rows: 2,
      description:
        "The lead sentence under the title (e.g. what the support team helps with).",
    }),
    defineField({
      name: "email",
      title: "Support email",
      type: "string",
      description: "Shown in the Contact card and used for the mailto link.",
    }),
    defineField({
      name: "hours",
      title: "Support hours",
      type: "string",
      description: 'e.g. "Monday–Friday, 9:00 AM–5:00 PM CST".',
    }),
    defineField({
      name: "address",
      title: "Mailing address",
      type: "text",
      rows: 4,
      description:
        "One line per row — rendered as-is in the Contact card (company, street, city/state/ZIP, country).",
    }),
    defineField({
      name: "body",
      title: "Sections",
      type: "array",
      description:
        "The sections below the contact card. Use Heading 2 for each section (they become the table-of-contents entries), Heading 3 for sub-sections.",
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
                      r.required().uri({
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
    }),
  ],
  preview: { prepare: () => ({ title: "Customer Support" }) },
});
