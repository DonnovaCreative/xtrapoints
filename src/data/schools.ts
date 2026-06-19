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
  /** Small square mark (e.g. paw) tinted with the accent; used in the app mockup. */
  mark?: string;
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
    logo: "/assets/schools/sam-houston/logo-white.svg", // white Bearkat mascot
    mark: "/assets/schools/sam-houston/paw.svg", // paw (inherits accent)
    theme: {
      primary: "#ff5200", // Bearkat Orange (official SHSU brand)
      primaryDeep: "#e64a00",
      primaryDark: "#cc4200", // darker for text/icons on light backgrounds
      primarySoft: "rgba(255, 82, 0, 0.12)",
      ink: "#1e1d23", // official SHSU navy grey for dark sections
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
    // Re-skin the few shared components that use the blue "primary" scale
    // (Eyebrow label, DonorDashboard monogram) to the school accent.
    `--color-primary-500:${t.primary}`,
    `--color-primary-600:${t.primaryDeep}`,
    `--color-primary-800:${t.primaryDark}`,
  ].join(";") + ";";
