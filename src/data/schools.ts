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
  /** Dark section background. */
  ink: string;
  /** Text/icon color ON the accent (button labels). Defaults to ink — set to
   *  white for mid/dark accents (e.g. red) where dark text wouldn't read. */
  onAccent?: string;
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
  /** Set true for a COLORED logo (e.g. dark-maned) — renders it on a white
   *  badge so it stays visible on the dark header. Omit for white/mono logos. */
  logoBadge?: boolean;
  /** Header logo sizing classes. Default "h-7 w-auto"; bump for wide wordmarks. */
  logoClass?: string;
  /** Small square mark (e.g. paw) tinted with the accent; used in the app mockup. */
  mark?: string;
  /** Full-color square logo for the app mockup avatar (takes priority over `mark`). */
  avatar?: string;
  /** Real game-day photography — adds school spirit across the pages. */
  photos?: {
    team?: string; // team in uniform (hero atmosphere)
    fans?: string; // student / fan crowd
    celebrate?: string; // player celebration
    mascot?: string; // mascot
    action?: string; // extra action / celebration shot
  };
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
    photos: {
      team: "/assets/schools/sam-houston/team.webp",
      fans: "/assets/schools/sam-houston/fans.jpg",
      celebrate: "/assets/schools/sam-houston/celebrate.jpg",
      mascot: "/assets/schools/sam-houston/mascot.jpg",
      action: "/assets/schools/sam-houston/action.jpg",
    },
    theme: {
      primary: "#ff5200", // Bearkat Orange (official SHSU brand)
      primaryDeep: "#e64a00",
      primaryDark: "#cc4200", // darker for text/icons on light backgrounds
      primarySoft: "rgba(255, 82, 0, 0.12)",
      ink: "#1e1d23", // official SHSU navy grey for dark sections
    },
  },
  {
    slug: "westminster",
    name: "Westminster Academy",
    short: "Westminster Academy",
    mascot: "Lions",
    fund: "Lions Athletics Fund",
    city: "Fort Lauderdale",
    state: "FL",
    logo: "/assets/schools/westminster/logo-white.png", // white wide crest + wordmark lockup
    logoClass: "h-8 w-auto", // wide horizontal lockup
    avatar: "/assets/schools/westminster/avatar.png", // color Lions head (app mockup)
    photos: {
      team: "/assets/schools/westminster/team.jpg",
      fans: "/assets/schools/westminster/fans.jpg",
      celebrate: "/assets/schools/westminster/celebrate.webp",
      mascot: "/assets/schools/westminster/mascot.jpg",
      action: "/assets/schools/westminster/action.jpg",
    },
    theme: {
      primary: "#e51937", // Westminster red (official brand)
      primaryDeep: "#cc1431",
      primaryDark: "#b3122b", // darker red for text/icons on white (contrast)
      primarySoft: "rgba(229, 25, 55, 0.12)",
      ink: "#002a5c", // Westminster navy for dark sections
      onAccent: "#ffffff", // white reads on the red accent (navy would be muddy)
    },
  },
];

/** Convert a #rrggbb hex to an rgba() string at the given alpha. */
export const hexToRgba = (hex: string, alpha: number): string => {
  const [r, g, b] = (hex.replace("#", "").match(/.{2}/g) ?? ["00", "00", "00"]).map(
    (h) => parseInt(h, 16),
  );
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** Darken a #rrggbb hex toward black by `amount` (0–1). */
export const darken = (hex: string, amount: number): string => {
  const f = 1 - amount;
  const parts = (hex.replace("#", "").match(/.{2}/g) ?? ["00", "00", "00"]).map((h) =>
    Math.max(0, Math.min(255, Math.round(parseInt(h, 16) * f)))
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${parts.join("")}`;
};

/**
 * Build a full SchoolTheme from just `primary` + `ink` (the CMS inputs), deriving
 * the hover/darker/soft accent shades. Matches the hand-tuned values the two
 * launch schools shipped with (deep ≈ 10% darker, dark ≈ 22% darker for
 * on-white contrast). `primaryDark` and `onAccent` can be overridden — set
 * `primaryDark` for very bright accents where the derived shade isn't dark
 * enough to read on white.
 */
export const deriveSchoolTheme = (input: {
  primary: string;
  ink: string;
  onAccent?: string;
  primaryDark?: string;
}): SchoolTheme => ({
  primary: input.primary,
  primaryDeep: darken(input.primary, 0.1),
  primaryDark: input.primaryDark ?? darken(input.primary, 0.22),
  primarySoft: hexToRgba(input.primary, 0.12),
  ink: input.ink,
  ...(input.onAccent ? { onAccent: input.onAccent } : {}),
});

/** Inline CSS that re-maps the global accent/ink tokens to a school's palette. */
export const schoolThemeVars = (t: SchoolTheme): string =>
  [
    `--color-lime:${t.primary}`,
    `--color-lime-deep:${t.primaryDeep}`,
    `--color-lime-dark:${t.primaryDark}`,
    `--color-lime-soft:${t.primarySoft}`,
    `--color-ink:${t.ink}`,
    `--color-on-accent:${t.onAccent ?? t.ink}`,
    // Re-skin the few shared components that use the blue "primary" scale
    // (Eyebrow label, DonorDashboard monogram) to the school accent.
    `--color-primary-500:${t.primary}`,
    `--color-primary-600:${t.primaryDeep}`,
    `--color-primary-800:${t.primaryDark}`,
  ].join(";") + ";";
