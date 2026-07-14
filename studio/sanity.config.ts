import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { visionTool } from "@sanity/vision";
import { schemaTypes } from "./schemas";
import {
  schoolDonorPreview,
  schoolAmbassadorPreview,
  legalPreview,
  supportPreview,
} from "./previewAction";
import { collegeAutofillAction } from "./collegeAutofillAction";

export default defineConfig({
  name: "default",
  title: "XtraPoint Schools",

  projectId: "xjhhxbqk",
  dataset: "production",

  plugins: [
    structureTool({
      // Schools at the top; everything legal/compliance/support grouped together
      // in one "Legal & Compliance" folder so the client's team can manage all of
      // it (legal documents, the support page, and the school-page legal copy) in
      // one place. supportPage + siteSettings are singletons (single document).
      structure: (S) =>
        S.list()
          .title("Content")
          .items([
            S.documentTypeListItem("school").title("Schools"),
            S.divider(),
            S.listItem()
              .title("Legal & Compliance")
              .id("legal-compliance")
              .child(
                S.list()
                  .title("Legal & Compliance")
                  .items([
                    S.documentTypeListItem("legalPage").title("Legal Documents"),
                    S.listItem()
                      .title("Customer Support")
                      .id("supportPage")
                      .child(
                        S.document()
                          .schemaType("supportPage")
                          .documentId("supportPage"),
                      ),
                    S.listItem()
                      .title("School page legal copy")
                      .id("siteSettings")
                      .child(
                        S.document()
                          .schemaType("siteSettings")
                          .documentId("siteSettings"),
                      ),
                  ]),
              ),
          ]),
    }),
    visionTool(),
  ],

  document: {
    // Keep the singletons out of the global "create new" menu.
    newDocumentOptions: (prev, { creationContext }) =>
      creationContext.type === "global"
        ? prev.filter(
            (t) => t.templateId !== "siteSettings" && t.templateId !== "supportPage",
          )
        : prev,
    // Add draft-preview actions: school docs → donor + ambassador; legal → page.
    actions: (prev, { schemaType }) =>
      schemaType === "school"
        ? [...prev, collegeAutofillAction, schoolDonorPreview, schoolAmbassadorPreview]
        : schemaType === "legalPage"
          ? [...prev, legalPreview]
          : schemaType === "supportPage"
            ? [...prev, supportPreview]
            : prev,
  },

  schema: {
    types: schemaTypes,
  },
});
