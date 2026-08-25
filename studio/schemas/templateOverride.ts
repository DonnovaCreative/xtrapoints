import { defineField, defineType } from "sanity";

// A school's tweaks to one generated marketing template.
//
// MACHINE-MANAGED. Schools write these from the Marketing Portal's customise
// screen (src/pages/api/portal-template.ts); the fields they're allowed to touch
// are declared in src/lib/templateFields.ts, which is also what renders the
// editor. It's listed in the Studio so support can see what a school changed and
// clear a value for them — not as somewhere to author content.
//
// Deliberately NOT part of the draft/publish review flow the school document
// uses. Brand edits go to a draft because they change public pages; these change
// a PDF the school prints themselves, so they take effect immediately. Clearing
// a value returns that piece to the template's derived default.
//
// One document per school per template, with a deterministic _id
// (`tplov-<schoolSlug>-<templateId>`), so a write is an upsert and there can
// never be two competing override sets for the same sheet.
export default defineType({
  name: "templateOverride",
  title: "Template customisation",
  type: "document",
  fields: [
    defineField({
      name: "schoolSlug",
      title: "School",
      type: "string",
      readOnly: true,
      validation: (r) => r.required(),
    }),
    defineField({
      name: "templateId",
      title: "Template",
      type: "string",
      readOnly: true,
      description: 'Matches an id in the site\'s generated-template registry, e.g. "ambassador-flyer".',
      validation: (r) => r.required(),
    }),
    defineField({
      name: "fields",
      title: "Text, links and colors",
      type: "array",
      description:
        "Each entry replaces one piece of the template. Delete an entry to put that piece back to its automatic value.",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "key", title: "Field", type: "string" }),
            defineField({ name: "value", title: "Value", type: "text", rows: 2 }),
          ],
          preview: {
            select: { title: "key", subtitle: "value" },
          },
        },
      ],
    }),
    defineField({
      name: "lists",
      title: "Lists",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "key", title: "Field", type: "string" }),
            defineField({ name: "items", title: "Items", type: "array", of: [{ type: "string" }] }),
          ],
          preview: {
            select: { title: "key", items: "items" },
            prepare: ({ title, items }) => ({
              title,
              subtitle: `${(items as string[] | undefined)?.length ?? 0} items`,
            }),
          },
        },
      ],
    }),
    defineField({
      name: "images",
      title: "Replaced images",
      type: "array",
      of: [
        {
          type: "object",
          fields: [
            defineField({ name: "key", title: "Slot", type: "string" }),
            defineField({ name: "asset", title: "Image", type: "image" }),
          ],
          preview: {
            select: { title: "key", media: "asset" },
          },
        },
      ],
    }),
    defineField({
      name: "updatedAt",
      title: "Last changed",
      type: "datetime",
      readOnly: true,
      description: "Also the cache key for the exported PDF, so a change is downloadable immediately.",
    }),
  ],
  preview: {
    select: { school: "schoolSlug", template: "templateId", updatedAt: "updatedAt" },
    prepare: ({ school, template, updatedAt }) => ({
      title: `${school} — ${template}`,
      subtitle: updatedAt ? `Changed ${new Date(updatedAt).toLocaleDateString()}` : "Never changed",
    }),
  },
});
