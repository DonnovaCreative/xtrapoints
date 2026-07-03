import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";
import { openPreviewAction } from "./previewAction";

export default defineConfig({
  name: "default",
  title: "XtraPoint Schools",

  projectId: "xjhhxbqk",
  dataset: "production",

  plugins: [
    structureTool({
      // Schools + Legal pages as lists, Site settings as a singleton document.
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.documentTypeListItem("school").title("Schools"),
            S.documentTypeListItem("legalPage").title("Legal pages"),
            S.divider(),
            S.listItem()
              .title("Site settings")
              .id("siteSettings")
              .child(
                S.document()
                  .schemaType("siteSettings")
                  .documentId("siteSettings"),
              ),
          ]),
    }),
    visionTool(),
  ],

  document: {
    // Keep the singleton out of the global "create new" menu.
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === "global"
        ? prev.filter((t) => t.templateId !== "siteSettings")
        : prev,
    // Add "Open preview" to school documents (draft preview on the live site).
    actions: (prev, { schemaType }) =>
      schemaType === "school" ? [...prev, openPreviewAction] : prev,
  },

  schema: {
    types: schemaTypes,
  },
});
