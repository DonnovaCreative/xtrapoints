// Reads the Customer Support page (singleton, doc type `supportPage`) from Sanity
// at build time. Unlike the legal documents, Support has its own bespoke layout
// (src/pages/support.astro): structured contact fields render the contact card,
// and `body` is rich text for the sections below it (rendered with the shared
// renderLegalBody helper).
import { sanityClient } from "@/config/sanity";
import type { PortableTextBlock } from "@portabletext/types";

export interface SupportPage {
  title: string;
  intro: string;
  email: string;
  hours: string;
  /** Multiline mailing address; one line per row. */
  address: string;
  body: PortableTextBlock[];
}

interface SupportDoc {
  title: string | null;
  intro: string | null;
  email: string | null;
  hours: string | null;
  address: string | null;
  body: PortableTextBlock[] | null;
}

const PROJECTION = `{ title, intro, email, hours, address, body }`;

const toSupportPage = (doc: SupportDoc): SupportPage => ({
  title: doc.title ?? "Customer Support",
  intro: doc.intro ?? "",
  email: doc.email ?? "",
  hours: doc.hours ?? "",
  address: doc.address ?? "",
  body: doc.body ?? [],
});

// Exclude drafts — the build authenticates with a token, so an editor's
// unpublished draft would otherwise shadow the published singleton.
export async function getSupportPage(): Promise<SupportPage | undefined> {
  const doc = await sanityClient.fetch<SupportDoc | null>(
    `*[_type == "supportPage" && !(_id in path("drafts.**"))][0]${PROJECTION}`,
  );
  return doc ? toSupportPage(doc) : undefined;
}

// Draft preview — used only by the secret-gated preview route
// (src/pages/preview/support.astro). The previewDrafts perspective returns the
// draft version (overlaid on published) so editors see unpublished edits.
const previewClient = sanityClient.withConfig({ perspective: "previewDrafts" });

/** The support page, preferring its unpublished draft. undefined if none. */
export async function getSupportPageDraft(): Promise<SupportPage | undefined> {
  const doc = await previewClient.fetch<SupportDoc | null>(
    `*[_type == "supportPage"][0]${PROJECTION}`,
  );
  return doc ? toSupportPage(doc) : undefined;
}
