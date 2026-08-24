// Sanity's CDN resizes and re-encodes on request, so nothing has to ask an
// editor for a correctly-sized upload — the same original serves a thumbnail and
// a print-resolution hero.
//
// This matters most on the printable sheets: they're rendered by headless
// Chromium, and whatever bytes the page pulls in end up embedded in the PDF. A
// full-resolution game-day photo behind the ambassador flyer's hero took the file
// from ~700KB to 6MB on its own.

/**
 * Cap a Sanity asset to the width it's actually rendered at.
 *
 * `fit=max` only ever shrinks, so passing a width larger than the original is
 * harmless. Non-Sanity URLs pass through untouched.
 */
export const sizedImage = (url: string, width: number, quality?: number): string => {
  if (!url.includes("cdn.sanity.io")) return url;
  // SVG is resolution-independent and Sanity doesn't rasterize it for these
  // params — a school logo is usually one, so leave them alone.
  if (url.endsWith(".svg")) return url;
  const q = quality === undefined ? "" : `&q=${quality}`;
  return `${url}?w=${width}&fit=max&auto=format${q}`;
};

/**
 * Crop an asset to the exact box it fills, around a focal point given in 0–1
 * fractions of the original.
 *
 * `sizedImage` caps a width but keeps the original's proportions, so a tall photo
 * in a wide band still carries all the height that CSS `cover` then throws away.
 * On a printable sheet that waste is real: Chromium flattens any image sitting
 * under a semi-transparent overlay into a bitmap at the SOURCE dimensions, so
 * cropping server-side is what actually decides the PDF's size.
 */
export const croppedImage = (
  url: string,
  width: number,
  height: number,
  { focusX = 0.5, focusY = 0.5, quality }: { focusX?: number; focusY?: number; quality?: number } = {},
): string => {
  if (!url.includes("cdn.sanity.io") || url.endsWith(".svg")) return url;
  const q = quality === undefined ? "" : `&q=${quality}`;
  return `${url}?w=${width}&h=${height}&fit=crop&crop=focalpoint&fp-x=${focusX}&fp-y=${focusY}&auto=format${q}`;
};
