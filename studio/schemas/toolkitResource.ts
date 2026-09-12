import { defineArrayMember, defineField, defineType } from "sanity";

const RESOURCE_IDS = ["guide", "catalog", "builder", "communications", "kickoff", "rules"];
const derived = ({ document }: { document?: Record<string, unknown> }) => document?.editorialRole === "derived";
const showFor = (...types: string[]) => ({ parent }: { parent?: Record<string, unknown> }) => !types.includes(String(parent?.type));

export const toolkitContentBlock = defineType({
  name: "xpToolkitContentBlock", title: "Content block", type: "object",
  fields: [
    defineField({ name: "id", title: "Source block ID", type: "string", readOnly: true }),
    defineField({ name: "type", title: "Block type", type: "string", initialValue: "paragraph", validation: (r) => r.required(), options: { list: [
      ["Paragraph", "paragraph"], ["Heading", "heading"], ["Bullet list", "list"], ["Numbered steps", "steps"],
      ["Callout", "callout"], ["Table", "table"], ["Message template", "message"], ["Link", "link"],
      ["Source citation", "source"], ["Image / screenshot", "image"], ["Video", "video"],
    ].map(([title, value]) => ({ title, value })) } }),
    defineField({ name: "text", title: "Text", type: "text", rows: 5, hidden: showFor("paragraph", "heading", "callout", "link") }),
    defineField({ name: "items", title: "Items / steps", type: "array", of: [{ type: "text" }], hidden: showFor("list", "steps") }),
    defineField({ name: "headers", title: "Column headings", type: "array", of: [{ type: "string" }], hidden: showFor("table") }),
    defineField({ name: "rows", title: "Table rows", type: "array", hidden: showFor("table"), of: [defineArrayMember({
      name: "toolkitTableRow", title: "Row", type: "object", fields: [
        defineField({ name: "cells", title: "Cells in column order", type: "array", of: [{ type: "text" }] }),
      ], preview: { select: { title: "cells.0" }, prepare: ({ title }) => ({ title: title || "Table row" }) },
    })] }),
    defineField({ name: "title", title: "Title", type: "string", hidden: showFor("message", "source", "image", "video") }),
    defineField({ name: "trigger", title: "When to use this message", type: "text", rows: 2, hidden: showFor("message") }),
    defineField({ name: "subject", title: "Subject", type: "string", hidden: showFor("message") }),
    defineField({ name: "body", title: "Message paragraphs", type: "array", of: [{ type: "text" }], hidden: showFor("message") }),
    defineField({ name: "primary_action", title: "Primary action", type: "text", rows: 2, hidden: showFor("message") }),
    defineField({ name: "href", title: "Link destination", type: "string", hidden: showFor("link"), description: "HTTPS URL, an internal /resources/ path, or an article anchor." }),
    defineField({ name: "url", title: "Source / video URL", type: "url", hidden: showFor("source", "video"), validation: (r) => r.uri({ scheme: ["https"] }) }),
    defineField({ name: "publisher", title: "Publisher", type: "string", hidden: showFor("source") }),
    defineField({ name: "evidence_type", title: "Evidence type", type: "string", hidden: showFor("source") }),
    defineField({ name: "observation", title: "Supported observation", type: "text", rows: 3, hidden: showFor("source") }),
    defineField({ name: "checked_on", title: "Checked on", type: "date", hidden: showFor("source") }),
    defineField({ name: "mediaStatus", title: "Media readiness", type: "string", initialValue: "placeholder", hidden: showFor("image", "video"), options: { list: [{ title: "Placeholder / requested", value: "placeholder" }, { title: "Verified and ready", value: "ready" }] } }),
    defineField({ name: "image", title: "Image / screenshot", type: "image", options: { hotspot: true }, hidden: showFor("image") }),
    defineField({ name: "src", title: "Existing hosted image URL", type: "url", hidden: showFor("image"), description: "Optional existing image URL instead of an upload; use a verified image with permission to share.", validation: (r) => r.uri({ scheme: ["https"] }) }),
    defineField({ name: "alt", title: "Image description", type: "string", hidden: showFor("image"), description: "Describe the helpful information or product step, not the file name." }),
    defineField({ name: "caption", title: "Caption", type: "text", rows: 2, hidden: showFor("image", "video") }),
    defineField({ name: "transcript", title: "Transcript / text alternative", type: "text", hidden: showFor("video") }),
    defineField({ name: "captionsSrc", title: "Video caption file URL", type: "url", hidden: showFor("video"), description: "WebVTT captions for a directly hosted video.", validation: (r) => r.uri({ scheme: ["https"] }) }),
    defineField({ name: "placeholderInstructions", title: "Media request", type: "text", rows: 3, hidden: showFor("image", "video"), description: "State the product screen or teaching point needed. Do not upload invented product screenshots." }),
    defineField({ name: "sourceBlockJson", title: "Retained source block", type: "text", hidden: true, readOnly: true }),
  ],
  validation: (r) => r.custom((value) => {
    const block = value as Record<string, unknown> | undefined;
    if (block?.mediaStatus !== "ready") return true;
    if (block.type === "image" && ((!block.image && !block.src) || !block.alt)) return "A ready image needs its file or hosted URL, and image description.";
    if (block.type === "video" && (!block.url || !block.transcript)) return "A ready video needs its URL and text alternative.";
    return true;
  }),
  preview: { select: { type: "type", text: "text", title: "title", image: "image" }, prepare: ({ type, text, title, image }) => ({ title: title || text || type || "New content block", subtitle: type, media: image }) },
});

export const toolkitArticle = defineType({
  name: "xpToolkitArticle", title: "Toolkit article", type: "document",
  groups: [{ name: "content", title: "Article", default: true }, { name: "details", title: "Findability" }, { name: "provenance", title: "Release workflow" }],
  fields: [
    defineField({ name: "title", title: "Title", type: "string", group: "content", readOnly: derived, validation: (r) => r.required() }),
    defineField({ name: "lede", title: "Short introduction", type: "text", rows: 3, group: "content", readOnly: derived }),
    defineField({ name: "blocks", title: "Article content", type: "array", group: "content", of: [{ type: "xpToolkitContentBlock" }], readOnly: derived }),
    defineField({ name: "context", title: "Supporting administrator guidance", type: "array", group: "content", of: [{ type: "xpToolkitContentBlock" }], readOnly: derived }),
    defineField({ name: "category", title: "Category", type: "string", group: "details", readOnly: derived }),
    defineField({ name: "audience", title: "Audience", type: "string", group: "details", readOnly: derived }),
    defineField({ name: "task", title: "Task this helps complete", type: "string", group: "details", readOnly: derived }),
    defineField({ name: "outcome", title: "Expected outcome", type: "text", rows: 2, group: "details", readOnly: derived }),
    defineField({ name: "searchTerms", title: "Additional search terms", type: "array", of: [{ type: "string" }], group: "details", readOnly: derived }),
    defineField({ name: "resourceRef", title: "Toolkit resource", type: "reference", to: [{ type: "xpToolkitResource" }], group: "provenance", readOnly: true }),
    defineField({ name: "id", title: "Stable article ID", type: "string", group: "provenance", readOnly: true }),
    defineField({ name: "resource", title: "Resource ID", type: "string", group: "provenance", readOnly: true }),
    defineField({ name: "kind", title: "Article purpose", type: "string", group: "provenance", readOnly: true }),
    defineField({ name: "editorialRole", title: "Edit location", type: "string", group: "provenance", readOnly: true, description: "Canonical sections are editable. Derived message pages, Builder topics and combined rules regenerate from their canonical sections." }),
    defineField({ name: "derivedFrom", title: "Edit the source section", type: "reference", to: [{ type: "xpToolkitArticle" }], group: "provenance", readOnly: true }),
    defineField({ name: "releaseVersion", title: "Imported toolkit release", type: "string", group: "provenance", readOnly: true }),
    defineField({ name: "sourceHash", title: "Imported source hash", type: "string", group: "provenance", readOnly: true }),
    defineField({ name: "editorInstructions", title: "Publishing instructions", type: "text", group: "provenance", readOnly: true }),
    defineField({ name: "sourceArticleJson", title: "Retained article source", type: "text", hidden: true, readOnly: true }),
  ],
  orderings: [{ title: "Resource, then article ID", name: "resourceArticle", by: [{ field: "resource", direction: "asc" }, { field: "id", direction: "asc" }] }],
  preview: { select: { title: "title", resource: "resource", role: "editorialRole" }, prepare: ({ title, resource, role }) => ({ title, subtitle: `${resource} · ${role || "canonical"}` }) },
});

export default defineType({
  name: "xpToolkitResource", title: "Toolkit resource", type: "document",
  fields: [
    defineField({ name: "id", title: "Resource ID", type: "string", readOnly: true, options: { list: RESOURCE_IDS }, validation: (r) => r.required() }),
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    defineField({ name: "description", title: "Purpose", type: "text", rows: 3 }),
    defineField({ name: "action", title: "Primary action label", type: "string" }),
    defineField({ name: "sourceVersion", title: "Resource edition", type: "string", readOnly: true, description: "Catalog 1.0 and rules 1.1 are intentionally part of toolkit release 1.2." }),
    defineField({ name: "releaseVersion", title: "Imported toolkit release", type: "string", readOnly: true }),
    defineField({ name: "sourceHash", title: "Imported source hash", type: "string", readOnly: true }),
    defineField({ name: "editorInstructions", title: "Publishing instructions", type: "text", readOnly: true }),
    defineField({ name: "sourceResourceJson", title: "Retained resource source", type: "text", hidden: true, readOnly: true }),
  ],
  preview: { select: { title: "title", subtitle: "id" } },
});
