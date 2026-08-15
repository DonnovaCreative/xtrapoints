// =============================================================================
// MARKETING RESOURCE LIBRARY — the shared catalog behind the portal's library
// page and each resource's own page (src/pages/portal/[token]/resources/…).
//
// Unlike school content, these documents are GLOBAL: the same library is served
// to every school. What varies per school is only how a "generated" format
// resolves to a URL (see src/lib/generatedTemplates.ts), which happens at render
// time, not here.
//
// The unit is the PIECE, not the file: one resource ships in as many formats as
// we've made it in (Canva, Figma, Illustrator, …), so a school picks the piece
// first and the tool they own second.
// =============================================================================
import { toHTML } from "@portabletext/to-html";
import type { PortableTextBlock } from "@portabletext/types";
import { sanityClient } from "@/config/sanity";

export type FormatSource = "staticFile" | "externalLink" | "generated";

/** Mirrors the `platform` option list in studio/schemas/resourceTemplate.ts. */
export const PLATFORM_LABELS: Record<string, string> = {
  canva: "Canva",
  figma: "Figma",
  // Bare product names: everyone knows Photoshop without "Adobe", and the extra
  // word is what pushes these labels into truncating in the formats list.
  illustrator: "Illustrator",
  photoshop: "Photoshop",
  indesign: "InDesign",
  express: "Adobe Express",
  googleSlides: "Google Slides",
  googleDocs: "Google Docs",
  powerpoint: "PowerPoint",
  keynote: "Keynote",
  pdf: "PDF",
  image: "Image",
  video: "Video",
  other: "Other",
};

export interface ResourceFormat {
  /** Stable key for React/Astro lists. */
  key: string;
  platform: string;
  /** Display name — the label override if set, else the platform's name. */
  label: string;
  source: FormatSource;
  /** staticFile: the hosted file. */
  file?: { url: string; extension?: string; size?: number; originalFilename?: string };
  /** externalLink: where it opens. */
  externalUrl?: string;
  /** generated: key into GENERATED_TEMPLATES. */
  templateId?: string;
  /** "Requires Illustrator CC 2023+" etc. */
  note?: string;
}

export interface ResourceSpec {
  label: string;
  value: string;
}

export interface Resource {
  id: string;
  slug: string;
  title: string;
  description?: string;
  category: string;
  /** Human label for the category (grouping header in the library). */
  categoryLabel: string;
  thumbnail?: string;
  formats: ResourceFormat[];
  specs: ResourceSpec[];
  /** Portable-text blocks for the resource's own page; rendered by resourceBody(). */
  overview?: unknown[];
}

// Mirrors the `category` option list in studio/schemas/resourceTemplate.ts.
// Order here is the order categories appear in the portal.
const CATEGORY_LABELS: Record<string, string> = {
  social: "Social media",
  email: "Email",
  print: "Print & signage",
  events: "Event materials",
  comms: "Fan & parent communications",
  ambassador: "Ambassador program",
  presentations: "Presentations",
  fundraising: "Fundraising campaigns",
  brand: "Brand & guidelines",
};
export const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

interface FormatDoc {
  _key: string | null;
  platform: string | null;
  label: string | null;
  source: FormatSource | null;
  file: {
    url: string | null;
    extension: string | null;
    size: number | null;
    originalFilename: string | null;
  } | null;
  externalUrl: string | null;
  templateId: string | null;
  note: string | null;
}

interface ResourceDoc {
  _id: string;
  slug: string | null;
  title: string | null;
  description: string | null;
  category: string | null;
  thumbnail: string | null;
  formats: FormatDoc[] | null;
  specs: { label: string | null; value: string | null }[] | null;
  overview: unknown[] | null;
}

// Published only (drafts would otherwise double up, same as the school query).
// Sorted by category, then the manual `order`, then title — GROQ puts null last
// in an ascending sort, so unordered items fall to the end of their category
// rather than jumping to the top.
const PROJECTION = `
  _id, title, description, category, specs, overview,
  "slug": slug.current,
  "thumbnail": thumbnail.asset->url,
  formats[]{
    _key, platform, label, source, externalUrl, templateId, note,
    "file": file.asset->{ url, extension, size, originalFilename }
  }
`;

const BASE = `*[_type == "resourceTemplate" && !(_id in path("drafts.**")) && defined(title) && defined(slug.current)]`;

const mapFormat = (f: FormatDoc, i: number): ResourceFormat | undefined => {
  const source = f.source ?? "staticFile";
  const platform = f.platform ?? "other";
  // A format with nothing behind it yet (half-filled in the Studio) is dropped
  // rather than rendered as a dead button.
  const hasTarget =
    (source === "staticFile" && f.file?.url) ||
    (source === "externalLink" && f.externalUrl) ||
    (source === "generated" && f.templateId);
  if (!hasTarget) return undefined;

  return {
    key: f._key ?? `${platform}-${i}`,
    platform,
    label: f.label || PLATFORM_LABELS[platform] || platform,
    source,
    ...(f.file?.url
      ? {
          file: {
            url: f.file.url,
            ...(f.file.extension ? { extension: f.file.extension } : {}),
            ...(f.file.size ? { size: f.file.size } : {}),
            ...(f.file.originalFilename ? { originalFilename: f.file.originalFilename } : {}),
          },
        }
      : {}),
    ...(f.externalUrl ? { externalUrl: f.externalUrl } : {}),
    ...(f.templateId ? { templateId: f.templateId } : {}),
    ...(f.note ? { note: f.note } : {}),
  };
};

const mapResource = (d: ResourceDoc): Resource => {
  const category = d.category ?? "brand";
  return {
    id: d._id,
    slug: d.slug!,
    title: d.title!,
    ...(d.description ? { description: d.description } : {}),
    category,
    categoryLabel: CATEGORY_LABELS[category] ?? category,
    ...(d.thumbnail ? { thumbnail: d.thumbnail } : {}),
    formats: (d.formats ?? [])
      .map(mapFormat)
      .filter((f): f is ResourceFormat => Boolean(f)),
    specs: (d.specs ?? [])
      .filter((s) => s.label && s.value)
      .map((s) => ({ label: s.label!, value: s.value! })),
    ...(d.overview?.length ? { overview: d.overview } : {}),
  };
};

/** The whole resource library, ready to group by category. */
export async function getResources(): Promise<Resource[]> {
  const docs = await sanityClient.fetch<ResourceDoc[]>(
    `${BASE}{${PROJECTION}} | order(category asc, order asc, title asc)`,
  );
  // A resource with no usable format has nothing to offer — leave it out rather
  // than showing a card that dead-ends.
  return docs.map(mapResource).filter((r) => r.formats.length > 0);
}

/** One resource by its slug, for its own page. */
export async function getResource(slug: string): Promise<Resource | undefined> {
  const doc = await sanityClient.fetch<ResourceDoc | null>(
    `${BASE.slice(0, -1)} && slug.current == $slug][0]{${PROJECTION}}`,
    { slug },
  );
  if (!doc?.title || !doc.slug) return undefined;
  const resource = mapResource(doc);
  return resource.formats.length > 0 ? resource : undefined;
}

/** Group resources into the category order the portal renders. */
export function groupByCategory(
  resources: Resource[],
): { category: string; label: string; items: Resource[] }[] {
  const seen = new Map<string, Resource[]>();
  for (const r of resources) {
    const list = seen.get(r.category);
    if (list) list.push(r);
    else seen.set(r.category, [r]);
  }
  // Known categories first, in CATEGORY_LABELS order; anything unrecognized
  // (e.g. a value removed from the schema later) still renders, at the end.
  const known = CATEGORY_ORDER.filter((c) => seen.has(c));
  const unknown = [...seen.keys()].filter((c) => !CATEGORY_ORDER.includes(c));
  return [...known, ...unknown].map((category) => ({
    category,
    label: CATEGORY_LABELS[category] ?? category,
    items: seen.get(category)!,
  }));
}

/**
 * The overview body as HTML for a resource's page. Styling comes from the
 * `.prose-portal` rules on the page, so editors get no say over presentation —
 * only structure — and every resource page reads the same.
 */
export function overviewHtml(blocks: unknown[] | undefined): string {
  if (!blocks?.length) return "";
  return toHTML(blocks as PortableTextBlock[], {
    components: {
      block: {
        normal: ({ children }: { children: string }) => `<p>${children}</p>`,
        h2: ({ children }: { children: string }) => `<h2>${children}</h2>`,
        h3: ({ children }: { children: string }) => `<h3>${children}</h3>`,
        blockquote: ({ children }: { children: string }) => `<blockquote>${children}</blockquote>`,
      },
      marks: {
        link: ({ children, value }: { children: string; value?: { href?: string } }) => {
          const href = value?.href ?? "#";
          const external = /^https?:\/\//i.test(href);
          const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
          return `<a href="${href}"${attrs}>${children}</a>`;
        },
      },
    },
  });
}

/** "1.4 MB" / "812 KB" — so a school knows before clicking a 200MB PSD. */
export const formatSize = (bytes?: number): string | undefined => {
  if (!bytes) return undefined;
  const mb = bytes / 1_000_000;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1000))} KB`;
};
