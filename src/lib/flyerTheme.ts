// Resolves a school's brand colors into the roles the ambassador flyer needs.
//
// The flyer is a DARK field (masthead, hero, pillar tiles, career strip) carrying
// white copy, a LIGHT band doing the opposite job, and a handful of small marks
// sitting on the bare white sheet. That's three roles with three different
// obligations, and a school's two brand colors have to be fitted to them:
//
//   base   — white body copy on it              ≥ 4.5:1 (7:1 preferred, see below)
//   accent — base-colored copy on it            ≥ 4.5:1   (the pillars band)
//   mark   — must be VISIBLE ON WHITE            (bullets, the CTA button)
//
// Every one of these is resolved by measurement, because the design's own palette
// (deep purple + gold) is only one of the shapes a school's colors come in:
//
//   • a light primary (Sam Houston orange) can't carry white copy, so `base`
//     swaps to the school's dark ink and the primary becomes the ACCENT — which
//     is the better flyer anyway: orange on black is what that school looks like.
//   • a mid-tone primary (Westminster red) technically passes 4.5:1 for white
//     copy but leaves no room above it for a light accent — every candidate then
//     lands near-white. Hence the 7:1 preference: force mid-tones down to a deep
//     shade so a real accent exists. Without it the flyer came out with an
//     invisible white-on-white pillars band.
//   • a pale accent (a school with no second brand color) is fine on the band but
//     disappears as a bullet on the white sheet — so `mark` is a separate role
//     that falls back to a color that can hold its own on white.
import { darken, hexToRgba, lighten, type SchoolTheme } from "@/data/schools";

const WHITE = "#ffffff";
/** WCAG AA for body text. */
const AA = 4.5;
/** Preferred depth for `base`, so a light accent still fits above it. */
const DEEP = 7;
/**
 * How far from the page a mark has to be to read as a shape on it. This is
 * deliberately NOT a WCAG threshold — the design's own gold bullets sit at about
 * 1.8:1 on white and read fine, because a saturated color is legible by hue where
 * a pale wash of the same luminance is not. The bar is set just under that gold.
 */
const MARK_ON_WHITE = 1.7;

const srgb = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

/** WCAG relative luminance of a #rrggbb hex (0 = black, 1 = white). */
export const luminance = (hex: string): number => {
  const [r, g, b] = (hex.replace("#", "").match(/.{2}/g) ?? ["00", "00", "00"]).map((h) =>
    srgb(parseInt(h, 16) / 255),
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two #rrggbb hexes (1–21). */
export const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

export interface FlyerTheme {
  /** The dark brand field: masthead, hero scrim, pillar tiles, all headings. */
  base: string;
  /** Deeper still — the career strip that sits under the two-column body. */
  baseDeep: string;
  /** The light band behind the pillars, and the badge/label fills ON `base`. */
  accent: string;
  /** Readable body ink for the blurb sitting on the accent band. */
  accentInk: string;
  /** For accent-role marks that sit on the bare white sheet, not on `base`. */
  mark: string;
  /** Text/icon color that reads on `mark`. */
  onMark: string;
  /** Hero gradient stops, laid over the photograph. */
  scrimTop: string;
  scrimBottom: string;
  /** False when the school's own secondary failed contrast and a tint was used. */
  usesBrandAccent: boolean;
  /** True when `base` had to be swapped away from theme.primary to stay legible. */
  swappedBase: boolean;
}

/** First candidate satisfying `ok`, else undefined. */
const first = (candidates: string[], ok: (c: string) => boolean): string | undefined =>
  candidates.find(ok);

/**
 * A school's own color picks for this sheet, from the portal's customise screen.
 *
 * They're offered to the resolver as the FIRST candidates rather than assigned
 * directly, so every contrast rule below still applies to them. A school that
 * picks a pale "dark background" gets the next legible option instead of a flyer
 * with white text on cream — the editor warns them separately, but the rendered
 * sheet is never allowed to become unreadable.
 */
export interface FlyerThemeOverrides {
  base?: string;
  accent?: string;
}

export const flyerTheme = (
  t: SchoolTheme,
  overrides: FlyerThemeOverrides = {},
): FlyerTheme => {
  // ── base ────────────────────────────────────────────────────────────────
  // Prefer a genuinely deep field; accept merely-legible only if nothing is
  // deeper, and fall back to a darkened primary, which always is.
  const baseCandidates = [
    ...(overrides.base ? [overrides.base] : []),
    t.primary,
    t.ink,
    darken(t.primary, 0.62),
  ];
  const base =
    first(baseCandidates, (c) => contrast(c, WHITE) >= DEEP) ??
    first(baseCandidates, (c) => contrast(c, WHITE) >= AA) ??
    darken(t.primary, 0.72);
  // Two different questions, and conflating them cost a school their accent:
  //   • is the primary still FREE to be the accent? — whenever it isn't the base,
  //     for any reason, including a school picking their own base color
  //   • did we have to SWAP off it for contrast? — only when nobody asked us to,
  //     which is what `swappedBase` reports to callers
  const primaryFree = base !== t.primary;
  const swappedBase = primaryFree && base !== overrides.base;

  // ── accent ──────────────────────────────────────────────────────────────
  // When base swapped OFF the primary, that primary is the best accent there is:
  // it's the school's dominant color and it's light by definition, so it lands in
  // exactly the role the design wants. Otherwise a real secondary wins. A pale
  // tint of the base is the floor — always on-brand, never pure white (which
  // would erase the band against the sheet).
  const accentCandidates = [
    ...(overrides.accent ? [overrides.accent] : []),
    ...(primaryFree ? [t.primary] : []),
    ...(t.hasSecondary ? [t.secondary] : []),
    lighten(base, 0.88),
    lighten(base, 0.94),
  ];
  const accent =
    first(accentCandidates, (c) => contrast(c, base) >= AA) ??
    accentCandidates[accentCandidates.length - 1];

  // ── accentInk ───────────────────────────────────────────────────────────
  // Body copy on the accent band: dark enough to read, still tinted by the accent.
  const inkCandidates = [darken(accent, 0.7), darken(accent, 0.85), "#222222"];
  const accentInk =
    first(inkCandidates, (c) => contrast(c, accent) >= AA) ?? "#222222";

  // ── mark ────────────────────────────────────────────────────────────────
  // The accent when it's a real color, the school's primary when the accent is a
  // pale tint, and the base when neither can hold the white page.
  const markCandidates = [accent, t.primary, base];
  let mark = first(markCandidates, (c) => contrast(c, WHITE) >= MARK_ON_WHITE) ?? base;

  // The CTA button is filled with `mark` and labelled on top of it. A mid-tone
  // mark — a school whose primary is a muted brown or olive — can be too dark for
  // the base to read on and too light for white, so take the better of the two
  // and, when even that falls short, deepen the mark until white carries.
  let onMark = contrast(base, mark) >= contrast(WHITE, mark) ? base : WHITE;
  if (contrast(onMark, mark) < AA) {
    mark = darken(mark, 0.4);
    onMark = WHITE;
  }

  return {
    base,
    baseDeep: darken(base, 0.35),
    accent,
    accentInk,
    mark,
    onMark,
    scrimTop: hexToRgba(base, 0.94),
    scrimBottom: hexToRgba(base, 0.78),
    usesBrandAccent: t.hasSecondary && accent === t.secondary,
    swappedBase,
  };
};
