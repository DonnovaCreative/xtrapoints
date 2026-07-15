import { defineType, defineField } from "sanity";

// Site-wide settings singleton (one document, id "siteSettings"). Shared across
// all co-branded school pages — see the structure config in sanity.config.ts.
export default defineType({
  name: "siteSettings",
  title: "Site settings",
  type: "document",
  fields: [
    defineField({
      name: "defaultVideoUrl",
      title: "Default explainer video",
      type: "url",
      description:
        "The standard XtraPoint explainer video (YouTube, Vimeo, or MP4), shown on every school page by default. A school can override it with its own video on the school doc (Page copy & media → Explainer video URL). Leave empty for no default.",
      validation: (r) => r.uri({ scheme: ["http", "https"] }),
    }),
    defineField({
      name: "legalCopy",
      title: "School page legal copy",
      type: "text",
      rows: 5,
      description:
        "Small legal / disclaimer text shown at the very bottom of every co-branded school page (donor + ambassador). Applies to all schools.",
    }),
  ],
  preview: { prepare: () => ({ title: "Site settings" }) },
});
