import { defineArrayMember, defineField, defineType } from "sanity";

export default defineType({
  name: "xpToolkitRelease", title: "Toolkit release", type: "document",
  // A reviewed release is an immutable edition. Make a new release for changes.
  readOnly: ({ document }) => document?.status === "approved" && !String(document?._id).startsWith("drafts."),
  fields: [
    defineField({ name: "title", title: "Release", type: "string", readOnly: true }),
    defineField({ name: "version", title: "Toolkit version", type: "string", readOnly: true, validation: (r) => r.required() }),
    defineField({ name: "revision", title: "Immutable release revision", type: "string", readOnly: true, validation: (r) => r.required() }),
    defineField({ name: "releaseDate", title: "Release date", type: "date", readOnly: true }),
    defineField({ name: "status", title: "Release review", type: "string", initialValue: "prepared", options: { list: [{ title: "Prepared for review", value: "prepared" }, { title: "Approved complete edition", value: "approved" }] }, description: "Approve only after regenerating, rendering and verifying all affected website and download editions together. Publishing articles alone never updates the Resource Center." }),
    defineField({ name: "approvedAt", title: "Approved at", type: "datetime", validation: (r) => r.custom((value, context) => context.document?.status === "approved" && !value ? "Record the review time before approving this release." : true) }),
    defineField({ name: "approvedBy", title: "Approved by", type: "string", validation: (r) => r.custom((value, context) => context.document?.status === "approved" && !value ? "Record the approving staff member." : true) }),
    defineField({ name: "editorInstructions", title: "Release instructions", type: "text", readOnly: true }),
    defineField({ name: "snapshotSha256", title: "Publication snapshot SHA-256", type: "string", readOnly: true, validation: (r) => r.required().regex(/^[a-f0-9]{64}$/) }),
    defineField({ name: "publicationSnapshot", title: "Generated immutable publication snapshot", type: "text", hidden: true, readOnly: true }),
    defineField({ name: "formats", title: "Verified download manifest", type: "array", readOnly: true, validation: (r) => r.required().length(6), of: [defineArrayMember({
      name: "toolkitReleaseFormat", title: "Download", type: "object", fields: [
        defineField({ name: "resourceId", title: "Resource ID", type: "string" }),
        defineField({ name: "filename", title: "File name", type: "string" }),
        defineField({ name: "format", title: "Format", type: "string" }),
        defineField({ name: "sha256", title: "SHA-256", type: "string" }),
        defineField({ name: "bytes", title: "File size", type: "number" }),
        defineField({ name: "source", title: "Delivery source", type: "string", description: "Bundled means a gated server download from the deployment carrying this exact release." }),
      ], preview: { select: { title: "filename", subtitle: "sha256" } },
    })] }),
    defineField({ name: "sourceHashes", title: "Canonical input hashes", type: "array", readOnly: true, of: [defineArrayMember({
      name: "toolkitSourceHash", type: "object", fields: [defineField({ name: "path", type: "string" }), defineField({ name: "sha256", type: "string" })], preview: { select: { title: "path", subtitle: "sha256" } },
    })] }),
  ],
  orderings: [{ title: "Latest release", name: "latest", by: [{ field: "releaseDate", direction: "desc" }] }],
  preview: { select: { title: "title", status: "status", revision: "revision" }, prepare: ({ title, status, revision }) => ({ title, subtitle: `${status} · ${revision}` }) },
});
