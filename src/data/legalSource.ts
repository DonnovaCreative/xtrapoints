// Reads legal pages (Terms, Privacy, …) from Sanity at build time. The page
// template calls getLegalPages()/getLegalPage(); it never touches the CMS
// directly (mirrors src/data/schoolsSource.ts).
import { sanityClient } from "@/config/sanity";
import type { LegalPage } from "@/data/legal";

interface LegalDoc {
  slug: string | null;
  title: string | null;
  navLabel: string | null;
  lastUpdated: string | null;
  body: LegalPage["body"] | null;
}

// Exclude drafts — the build authenticates with a token, so unpublished drafts
// (`drafts.legalPage.*`, created whenever an editor opens a doc in the Studio)
// would otherwise be returned alongside the published version and render twice.
const VALID = `_type == "legalPage" && !(_id in path("drafts.**")) && defined(slug.current) && defined(body)`;
const PROJECTION = `{
  "slug": slug.current,
  title, navLabel, lastUpdated, body
}`;

const toLegalPage = (doc: LegalDoc): LegalPage => ({
  slug: doc.slug!,
  title: doc.title ?? "",
  navLabel: doc.navLabel || doc.title || "",
  ...(doc.lastUpdated ? { lastUpdated: doc.lastUpdated } : {}),
  body: doc.body ?? [],
});

/** All legal pages, ordered by title (Privacy Policy, Terms & Conditions). */
export async function getLegalPages(): Promise<LegalPage[]> {
  const docs = await sanityClient.fetch<LegalDoc[]>(
    `*[${VALID}]${PROJECTION} | order(title asc)`,
  );
  return docs.map(toLegalPage);
}

/** One legal page by slug, or undefined. */
export async function getLegalPage(
  slug: string,
): Promise<LegalPage | undefined> {
  const doc = await sanityClient.fetch<LegalDoc | null>(
    `*[${VALID} && slug.current == $slug]${PROJECTION}[0]`,
    { slug },
  );
  return doc ? toLegalPage(doc) : undefined;
}
