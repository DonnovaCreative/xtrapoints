// =============================================================================
// SCHOOL TYPES + THEME HELPERS for the co-branded /schools/[slug] template.
//
// School CONTENT now lives in Sanity (see src/data/schoolsSource.ts, which maps
// CMS documents onto the `School` shape below). This file holds the shared
// types and the theming helpers used by the templates and the OG generator.
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
  /** Fill the header bar white (for colored logos with no white/mono version). */
  whiteHeader?: boolean;
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

/** XtraPoint brand defaults (see globals.css) — used when a school leaves a
 *  color empty. Lime accent + navy ink. */
export const BRAND_PRIMARY = "#aaf10a";
export const BRAND_INK = "#03116d";

/**
 * Build a full SchoolTheme from just `primary` + `ink` (the CMS inputs), deriving
 * the hover/darker/soft accent shades. Matches the hand-tuned values the two
 * launch schools shipped with (deep ≈ 10% darker, dark ≈ 22% darker for
 * on-white contrast). Empty `primary`/`ink` fall back to the XtraPoint brand.
 * `primaryDark` and `onAccent` can be overridden — set `primaryDark` for very
 * bright accents where the derived shade isn't dark enough to read on white.
 */
export const deriveSchoolTheme = (input: {
  primary?: string;
  ink?: string;
  onAccent?: string;
  primaryDark?: string;
}): SchoolTheme => {
  const primary = input.primary || BRAND_PRIMARY;
  return {
    primary,
    primaryDeep: darken(primary, 0.1),
    primaryDark: input.primaryDark || darken(primary, 0.22),
    primarySoft: hexToRgba(primary, 0.12),
    ink: input.ink || BRAND_INK,
    ...(input.onAccent ? { onAccent: input.onAccent } : {}),
  };
};

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
