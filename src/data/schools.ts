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
  /** Secondary accent for atmospheric depth (glows, gradients, soft fills).
   *  A real secondary brand color, or a lighter tint of primary if none. */
  secondary: string;
  /** True when a real secondary brand color was set (not the primary-tint fallback). */
  hasSecondary: boolean;
  /** Translucent secondary for soft fills (rgba). */
  secondarySoft: string;
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
  // ── Resolved naming for copy (see schoolsSource `naming`) ──
  /** Who supporters help, e.g. "Bearkat Athletes". Defaults to "the <mascot>". */
  beneficiary: string;
  /** Optional collective/fund brand, e.g. "KatFund". Undefined when not set. */
  collective?: string;
  /** Ambassador program name: the collective, else the school short name. */
  programName: string;
  /** Who approves ambassadors: the collective, else the fund name. */
  approver: string;
  /** Giving destination phrase: "<beneficiary> through <collective>", else "the <fund>". */
  givingDest: string;
  /** Optional custom "Why give" heading + body (fund's own donor pitch). */
  whyGiveHeading?: string;
  whyGiveBody?: string;
  /** Optional per-school explainer video URL (overrides the site default). */
  videoUrl?: string;
  /** Optional heading/caption for the video block (default when empty). */
  videoHeading?: string;
  videoCaption?: string;
  /** Mono/white logo for the dark co-brand header. Empty → styled wordmark. */
  logo?: string;
  /** Set true for a COLORED logo (e.g. dark-maned) — renders it on a white
   *  badge so it stays visible on the dark header. Omit for white/mono logos. */
  logoBadge?: boolean;
  /** Fill the header bar white (for colored logos with no white/mono version). */
  whiteHeader?: boolean;
  /** Lock the school's short name up beside the logo in the header — for small/
   *  square logos (common for high schools) that read poorly alone. */
  logoLockup?: boolean;
  /** Resolved header logo height in px (from the size preset or custom slider). */
  logoHeightPx?: number;
  /** Header hugs the logo (no fixed bar height) instead of the standard 68px. */
  headerHug?: boolean;
  /** Vertical padding per side in the header row when hugging (0 = flush). */
  headerPadPx?: number;
  /** The header height (= --header-h) for this school: 68 fixed, or logo-based. */
  headerHeightPx?: number;
  /** Full-color square logo for the app mockup avatar. */
  avatar?: string;
  /** Real game-day photography — adds school spirit across the pages. */
  photos?: {
    team?: string; // team in uniform (hero atmosphere)
    fans?: string; // student / fan crowd
    celebrate?: string; // player celebration
    mascot?: string; // mascot
    action?: string; // extra action / celebration shot
    /** Photographer/source credit per photo, keyed the same as above. */
    credits?: Partial<Record<"team" | "fans" | "celebrate" | "mascot" | "action", string>>;
  };
  /** Optional custom Ambassador page reward tiers. Empty → the standard
   *  Bronze/Silver/Gold defaults (see SchoolAmbassadors.astro). */
  ambassadorTiers?: {
    name: string;
    role?: string;
    perks?: string[];
    highlight?: boolean;
  }[];
  /** Optional custom Ambassador page recognition cards (e.g. "Ambassador of
   *  the Month"). Empty → the standard defaults. */
  ambassadorPrograms?: { title: string; body?: string }[];
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

/** Lighten a #rrggbb hex toward white by `amount` (0–1). */
export const lighten = (hex: string, amount: number): string => {
  const parts = (hex.replace("#", "").match(/.{2}/g) ?? ["00", "00", "00"]).map((h) => {
    const v = parseInt(h, 16);
    return Math.max(0, Math.min(255, Math.round(v + (255 - v) * amount)))
      .toString(16)
      .padStart(2, "0");
  });
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
  secondary?: string;
  ink?: string;
  onAccent?: string;
  primaryDark?: string;
}): SchoolTheme => {
  // Only accept #rrggbb strings; anything else (empty, or a stray object from an
  // older format) falls back to the brand default rather than crashing.
  const hex = (v: unknown): string | undefined =>
    typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : undefined;
  const primary = hex(input.primary) ?? BRAND_PRIMARY;
  // Two-color brand → use the real secondary; single-color → a lighter same-hue
  // tint of primary, so atmospheric layers get depth without a second color.
  const realSecondary = hex(input.secondary);
  const secondary = realSecondary ?? lighten(primary, 0.4);
  return {
    primary,
    primaryDeep: darken(primary, 0.1),
    primaryDark: hex(input.primaryDark) ?? darken(primary, 0.22),
    primarySoft: hexToRgba(primary, 0.12),
    secondary,
    hasSecondary: Boolean(realSecondary),
    secondarySoft: hexToRgba(secondary, 0.14),
    ink: hex(input.ink) ?? BRAND_INK,
    ...(hex(input.onAccent) ? { onAccent: hex(input.onAccent) } : {}),
  };
};

/** Inline CSS that re-maps the global accent/ink tokens to a school's palette. */
export const schoolThemeVars = (t: SchoolTheme): string =>
  [
    `--color-lime:${t.primary}`,
    `--color-lime-deep:${t.primaryDeep}`,
    `--color-lime-dark:${t.primaryDark}`,
    `--color-lime-soft:${t.primarySoft}`,
    `--color-accent-2:${t.secondary}`,
    `--color-accent-2-soft:${t.secondarySoft}`,
    `--color-ink:${t.ink}`,
    `--color-on-accent:${t.onAccent ?? t.ink}`,
    // Re-skin the few shared components that use the blue "primary" scale
    // (Eyebrow label, DonorDashboard monogram) to the school accent.
    `--color-primary-500:${t.primary}`,
    `--color-primary-600:${t.primaryDeep}`,
    `--color-primary-800:${t.primaryDark}`,
  ].join(";") + ";";
