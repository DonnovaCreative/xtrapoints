// =============================================================================
// SCHOOL CONTENT SOURCE — reads co-branded school content from Sanity at build
// time (and in the on-demand OG function). Page templates and the OG endpoint
// only ever call getSchools()/getSchool(); they never touch the CMS directly.
//
// Image fields are resolved to their Sanity CDN URLs in GROQ (asset->url), and
// the brand theme is derived from primary + ink (see deriveSchoolTheme).
// =============================================================================
import { sanityClient } from "@/config/sanity";
import { deriveSchoolTheme, type School } from "@/data/schools";

// Shape returned by the GROQ projection below (before mapping to `School`).
interface SchoolDoc {
  slug: string | null;
  name: string | null;
  short: string | null;
  mascot: string | null;
  fund: string | null;
  city: string | null;
  state: string | null;
  logo: string | null;
  logoBadge: boolean | null;
  whiteHeader: boolean | null;
  logoLockup: boolean | null;
  logoSize: "sm" | "md" | "lg" | "xl" | "2xl" | "custom" | null;
  logoHeight: number | null;
  headerHug: boolean | null;
  headerPadding: boolean | null;
  mark: string | null;
  avatar: string | null;
  photos: Partial<
    Record<"team" | "fans" | "celebrate" | "mascot" | "action", string | null>
  > | null;
  theme: {
    primary: string | null;
    secondary: string | null;
    ink: string | null;
    onAccent: string | null;
    primaryDarkOverride: string | null;
  } | null;
}

// Any school with a slug renders — colors default to the XtraPoint brand.
// Exclude drafts — the build authenticates with a token, so unpublished drafts
// (`drafts.school.*`, created whenever an editor opens a doc in the Studio)
// would otherwise be returned alongside the published version and render twice.
const VALID = `_type == "school" && !(_id in path("drafts.**")) && defined(slug.current)`;

const PROJECTION = `{
  "slug": slug.current,
  name, short, mascot, fund, city, state,
  logoBadge, whiteHeader, logoLockup, logoSize, logoHeight, headerHug, headerPadding,
  "logo": logo.asset->url,
  "mark": mark.asset->url,
  "avatar": avatar.asset->url,
  "photos": {
    "team": photos.team.asset->url,
    "fans": photos.fans.asset->url,
    "celebrate": photos.celebrate.asset->url,
    "mascot": photos.mascot.asset->url,
    "action": photos.action.asset->url
  },
  "theme": {
    "primary": theme.primary,
    "secondary": theme.secondary,
    "ink": theme.ink,
    "onAccent": theme.onAccent,
    "primaryDarkOverride": theme.primaryDarkOverride
  }
}`;

// Header logo height presets → px (see SchoolHeader, which sets the height
// inline so the "custom" slider can use any value). Editors also get a custom
// size (24–120px) and can switch the header from the fixed 68px bar to hugging
// the logo (with optional padding). Computed per school in `headerMetrics`.
const LOGO_SIZE_PX: Record<string, number> = {
  sm: 24,
  md: 28, // default
  lg: 40,
  xl: 56,
  "2xl": 80,
};
const DEFAULT_HEADER_H = 68; // the fixed bar, matches --header-h (4.25rem)
const HEADER_PAD = 16; // standard vertical padding per side (hug mode)
const CTA_MIN = 44; // keep the header tall enough for the CTA/nav when hugging

/** Resolve logo height + header height/padding from the doc's size settings. */
function headerMetrics(doc: SchoolDoc) {
  const size = doc.logoSize ?? "md";
  const logoHeightPx =
    size === "custom"
      ? Math.min(120, Math.max(24, doc.logoHeight ?? 40))
      : (LOGO_SIZE_PX[size] ?? LOGO_SIZE_PX.md);
  const headerHug = doc.headerHug ?? false;
  const headerPadPx = doc.headerPadding === false ? 0 : HEADER_PAD;
  const headerHeightPx = headerHug
    ? Math.max(logoHeightPx, CTA_MIN) + headerPadPx * 2
    : DEFAULT_HEADER_H;
  return { logoHeightPx, headerHug, headerPadPx, headerHeightPx };
}

/** Drop null/empty photo entries so `school.photos?.team` behaves like before. */
const mapPhotos = (photos: SchoolDoc["photos"]): School["photos"] => {
  if (!photos) return undefined;
  const entries = Object.entries(photos).filter(([, v]) => Boolean(v)) as [
    keyof NonNullable<School["photos"]>,
    string,
  ][];
  return entries.length
    ? Object.fromEntries(entries)
    : undefined;
};

const toSchool = (doc: SchoolDoc): School => ({
  slug: doc.slug!,
  name: doc.name ?? "",
  short: doc.short ?? "",
  mascot: doc.mascot ?? "",
  fund: doc.fund ?? "",
  city: doc.city ?? "",
  state: doc.state ?? "",
  ...(doc.logo ? { logo: doc.logo } : {}),
  ...(doc.logoBadge ? { logoBadge: true } : {}),
  ...(doc.whiteHeader ? { whiteHeader: true } : {}),
  ...(doc.logoLockup ? { logoLockup: true } : {}),
  ...headerMetrics(doc),
  ...(doc.mark ? { mark: doc.mark } : {}),
  ...(doc.avatar ? { avatar: doc.avatar } : {}),
  ...(mapPhotos(doc.photos) ? { photos: mapPhotos(doc.photos) } : {}),
  theme: deriveSchoolTheme({
    primary: doc.theme?.primary ?? undefined,
    secondary: doc.theme?.secondary ?? undefined,
    ink: doc.theme?.ink ?? undefined,
    onAccent: doc.theme?.onAccent ?? undefined,
    primaryDark: doc.theme?.primaryDarkOverride ?? undefined,
  }),
});

/** All schools, ordered by name. */
export async function getSchools(): Promise<School[]> {
  const docs = await sanityClient.fetch<SchoolDoc[]>(
    `*[${VALID}]${PROJECTION} | order(name asc)`,
  );
  return docs.map(toSchool);
}

/** One school by slug, or undefined if there's no match. */
export async function getSchool(slug: string): Promise<School | undefined> {
  const doc = await sanityClient.fetch<SchoolDoc | null>(
    `*[${VALID} && slug.current == $slug]${PROJECTION}[0]`,
    { slug },
  );
  return doc ? toSchool(doc) : undefined;
}

// -----------------------------------------------------------------------------
// DRAFT PREVIEW — used only by the secret-gated on-demand preview route
// (src/pages/preview/schools/[slug].astro). The `previewDrafts` perspective
// overlays drafts on published content and returns the draft version (with a
// normalized _id), so editors can see unpublished edits before publishing.
// Never used by the static build, which reads published content only.
// -----------------------------------------------------------------------------
const previewClient = sanityClient.withConfig({ perspective: "previewDrafts" });

/** One school by slug, preferring its unpublished draft. undefined if none. */
export async function getSchoolDraft(
  slug: string,
): Promise<School | undefined> {
  const doc = await previewClient.fetch<SchoolDoc | null>(
    `*[_type == "school" && slug.current == $slug]${PROJECTION}[0]`,
    { slug },
  );
  return doc ? toSchool(doc) : undefined;
}

/** Site-wide settings singleton (shared across all school pages). */
export interface SiteSettings {
  legalCopy?: string;
}
export async function getSiteSettings(): Promise<SiteSettings> {
  const s = await sanityClient.fetch<{ legalCopy?: string } | null>(
    `*[_id == "siteSettings"][0]{ legalCopy }`,
  );
  return { legalCopy: s?.legalCopy || undefined };
}
