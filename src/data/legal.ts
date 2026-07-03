// =============================================================================
// LEGAL PAGES — types + Portable Text → HTML rendering for the Terms / Privacy
// pages. Content lives in Sanity (doc type `legalPage`) and is authored as rich
// text; the sticky table-of-contents is derived from the H2/H3 headings here so
// editors never touch code to restructure a page.
// =============================================================================
import { toHTML } from "@portabletext/to-html";
import type { PortableTextBlock } from "@portabletext/types";

export interface LegalPage {
  slug: string;
  title: string;
  /** Short label for the cross-page quick-links (falls back to title). */
  navLabel: string;
  /** ISO date string (yyyy-mm-dd) or undefined. */
  lastUpdated?: string;
  body: PortableTextBlock[];
}

/** One entry in the on-page table of contents. */
export interface TocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

/** "What information do we collect?" → "what-information-do-we-collect". */
export const slugifyHeading = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "section";

const blockText = (block: PortableTextBlock): string =>
  ((block.children as { text?: string }[] | undefined) ?? [])
    .map((c) => c.text ?? "")
    .join("")
    .trim();

/**
 * Render a legal page body to HTML and derive its table of contents in a single
 * coordinated pass: heading ids are assigned once (deduped) and looked up by the
 * block's `_key` during serialization, so the TOC anchors and the rendered
 * heading ids always match.
 */
export function renderLegalBody(body: PortableTextBlock[]): {
  html: string;
  toc: TocEntry[];
} {
  const toc: TocEntry[] = [];
  const idByKey = new Map<string, string>();
  const seen = new Map<string, number>();

  for (const block of body) {
    if (block._type !== "block") continue;
    const style = block.style;
    if (style !== "h2" && style !== "h3") continue;
    const text = blockText(block);
    if (!text) continue;
    const base = slugifyHeading(text);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = n === 0 ? base : `${base}-${n + 1}`;
    idByKey.set(block._key as string, id);
    toc.push({ id, text, level: style === "h2" ? 2 : 3 });
  }

  const heading = (tag: "h2" | "h3") => ({
    children,
    value,
  }: {
    children: string;
    value: PortableTextBlock;
  }) => `<${tag} id="${idByKey.get(value._key as string) ?? ""}">${children}</${tag}>`;

  const html = toHTML(body, {
    components: {
      block: {
        normal: ({ children }: { children: string }) => `<p>${children}</p>`,
        h2: heading("h2"),
        h3: heading("h3"),
        blockquote: ({ children }: { children: string }) =>
          `<blockquote>${children}</blockquote>`,
      },
      marks: {
        link: ({
          children,
          value,
        }: {
          children: string;
          value?: { href?: string };
        }) => {
          const href = value?.href ?? "#";
          const external = /^https?:\/\//i.test(href);
          const attrs = external
            ? ' target="_blank" rel="noopener noreferrer"'
            : "";
          return `<a href="${href}"${attrs}>${children}</a>`;
        },
      },
    },
  });

  return { html, toc };
}
