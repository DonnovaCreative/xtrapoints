// Registry of GENERATED marketing templates — the ones built per school from
// their own logo and colors, rather than served as one shared file.
//
// This is the deliberate seam in the resource library: hosted files and Canva
// links are pure content (upload in the Studio, done), but a generated template
// is real code — an Astro page plus a render route, like the one-pager's
// src/pages/schools/[school]/one-pager.astro + one-pager.pdf.ts. So the set of
// generated templates only grows when someone adds one here, while the rest of
// the library grows without a developer.
//
// A `resourceTemplate` document with assetType "generated" points at one of
// these by id. An id with no entry here is skipped rather than rendered broken,
// so removing a template from the code can't break a school's portal.
//
// Keep the ids in sync with GENERATED_TEMPLATE_IDS in
// studio/schemas/resourceTemplate.ts (the Studio can't import from the site).
import type { School } from "@/data/schools";

export interface GeneratedTemplate {
  /** Primary action — the file the school actually downloads. */
  downloadHref: (school: School) => string;
  /** Optional in-browser view of the same thing before downloading. */
  previewHref?: (school: School) => string;
  /**
   * Optional image of the finished piece, in this school's brand. Unlike an
   * uploaded thumbnail this is rendered from the template itself, so it can't go
   * stale when a school changes its logo or colors. The portal shows it on the
   * card and opens it full screen.
   */
  thumbnailHref?: (school: School) => string;
  /** Label for the primary button. */
  downloadLabel: string;
}

export const GENERATED_TEMPLATES: Record<string, GeneratedTemplate> = {
  "one-pager": {
    downloadHref: (s) => `/schools/${s.slug}/one-pager.pdf`,
    previewHref: (s) => `/schools/${s.slug}/one-pager`,
    thumbnailHref: (s) => `/schools/${s.slug}/one-pager.png`,
    downloadLabel: "Download PDF",
  },
  "ambassador-flyer": {
    downloadHref: (s) => `/schools/${s.slug}/ambassador-flyer.pdf`,
    previewHref: (s) => `/schools/${s.slug}/ambassador-flyer`,
    thumbnailHref: (s) => `/schools/${s.slug}/ambassador-flyer.png`,
    downloadLabel: "Download PDF",
  },
};

export const getGeneratedTemplate = (id: string | undefined): GeneratedTemplate | undefined =>
  id ? GENERATED_TEMPLATES[id] : undefined;
