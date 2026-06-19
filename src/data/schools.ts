// =============================================================================
// SCHOOL PARTNER REGISTRY — the co-branded /schools/[slug] template is driven
// entirely by this list. To launch a new partner school, add one entry here
// (name, mascot, fund, brand colors, logo) — no new components needed.
//
// Theming works by OVERRIDING the global design tokens per page (see
// schoolThemeVars): the whole XtraPoint design language re-skins to the school's
// accent color, while layout/typography/motion stay identical.
// =============================================================================

export interface SchoolTheme {
  /** Accent (replaces lime) — buttons, highlights, chips. */
  primary: string;
  /** Hover/pressed accent. */
  primaryDeep: string;
  /** Darker accent for text/icons on light backgrounds (contrast). */
  primaryDark: string;
  /** Translucent accent for soft fills (rgba). */
  primarySoft: string;
  /** Dark section background + button text color. */
  ink: string;
}

export interface School {
  slug: string;
  name: string; // "Sam Houston State University"
  short: string; // "Sam Houston State"
  mascot: string; // "Bearkats"
  fund: string; // "Bearkat Athletics Fund"
  city: string;
  state: string;
  /** Mono/white logo for the dark co-brand header. Empty → styled wordmark. */
  logo?: string;
  theme: SchoolTheme;
}

export const schools: School[] = [
  {
    slug: "sam-houston",
    name: "Sam Houston State University",
    short: "Sam Houston State",
    mascot: "Bearkats",
    fund: "Bearkat Athletics Fund",
    city: "Huntsville",
    state: "TX",
    // ⚠ Drop the official Bearkat paw/wordmark SVG here to replace the text lockup:
    // logo: "/assets/schools/sam-houston/logo-white.svg",
    theme: {
      primary: "#F26426", // Bearkat Orange (sampled from the SHSU app mockup)
      primaryDeep: "#DD511B",
      primaryDark: "#B8430F",
      primarySoft: "rgba(242, 100, 38, 0.12)",
      ink: "#17120E", // warm near-black for dark sections
    },
  },
];

export const getSchool = (slug: string): School | undefined =>
  schools.find((s) => s.slug === slug);

/** Inline CSS that re-maps the global accent/ink tokens to a school's palette. */
export const schoolThemeVars = (t: SchoolTheme): string =>
  [
    `--color-lime:${t.primary}`,
    `--color-lime-deep:${t.primaryDeep}`,
    `--color-lime-dark:${t.primaryDark}`,
    `--color-lime-soft:${t.primarySoft}`,
    `--color-ink:${t.ink}`,
  ].join(";") + ";";
