// What a SCHOOL is allowed to change about itself.
//
// This is the security boundary for the portal's brand editor. The rule is an
// allowlist, never a blocklist: a field a school can edit has to be named here
// explicitly, so adding a sensitive field to the schema later can't accidentally
// become editable by them.
//
// Emphatically NOT editable here, and worth stating so nobody adds them
// casually: `productionStatus` and `approvedVersion` (a school could publish
// itself to xtrapoint.com), `portalEnabled` and `portalToken` (access control),
// `slug` (their public URL, and what their Clerk org is matched on), and all
// page copy — copy is XtraPoint's until we deliberately open it up.

/** Image fields a school may replace, mapped to their path on the document. */
export const EDITABLE_IMAGES = {
  logo: { path: "logo", label: "Header logo", note: "White or single-color, for dark backgrounds" },
  avatar: { path: "avatar", label: "App avatar", note: "Full-color square mark" },
  "photos.team": { path: "photos.team", label: "Team", note: "Donor page hero background" },
  "photos.celebrate": { path: "photos.celebrate", label: "Celebrate", note: "Donor page spirit band" },
  "photos.fans": { path: "photos.fans", label: "Fans", note: "Ambassador page callout" },
  "photos.action": { path: "photos.action", label: "Action", note: "Ambassador page hero background" },
  "photos.mascot": { path: "photos.mascot", label: "Mascot", note: "Ambassador page spirit band" },
} as const;

export type EditableImage = keyof typeof EDITABLE_IMAGES;

/** Photos carry an optional credit line; logos don't. */
export const CREDITABLE_IMAGES: EditableImage[] = [
  "photos.team",
  "photos.celebrate",
  "photos.fans",
  "photos.action",
  "photos.mascot",
];

export const isCreditable = (key: string): key is EditableImage =>
  (CREDITABLE_IMAGES as string[]).includes(key);

/** Long enough for "Photo by Jane Doe / Athletics Communications", not for an essay. */
export const MAX_CREDIT_LENGTH = 120;

export const isEditableImage = (key: string): key is EditableImage =>
  Object.prototype.hasOwnProperty.call(EDITABLE_IMAGES, key);

/**
 * Colors a school may set. `primaryDarkOverride` is deliberately excluded — it
 * exists to fix contrast when the derived shade is unreadable, and getting it
 * wrong makes text illegible rather than merely off-brand.
 */
export const EDITABLE_COLORS = {
  primary: { label: "Primary accent", note: "Buttons, highlights, links" },
  secondary: { label: "Secondary accent", note: "Optional — glows and gradients" },
  ink: { label: "Dark sections", note: "Header and dark bands. White text sits on this" },
  onAccent: { label: "Text on accent", note: "Optional — set white if your accent is dark" },
} as const;

export type EditableColor = keyof typeof EDITABLE_COLORS;

export const isEditableColor = (key: string): key is EditableColor =>
  Object.prototype.hasOwnProperty.call(EDITABLE_COLORS, key);

/** Same shape the Studio enforces, so the portal can't write a value the CMS would reject. */
export const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Uploads we accept.
 *
 * SVG is included because school logos usually are one, and it's safe in the
 * ways this site consumes them: every school asset is rendered as `<img src>`
 * from cdn.sanity.io, where script inside an SVG does not execute, and the one
 * place that reads the file itself (OnePagerView, which inlines a school asset
 * as a CSS mask) can't execute it either. Don't add a code path that injects a school
 * asset with `set:html` — that's the assumption this rests on.
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const;
export const MAX_IMAGE_BYTES = 8_000_000; // 8 MB — generous for a logo or a hero photo.

export const imageTypeLabel = "PNG, JPG, WebP or SVG, up to 8 MB";
