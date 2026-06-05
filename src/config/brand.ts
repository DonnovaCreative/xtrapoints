// =============================================================================
// BRAND CONFIG — single source of truth.
//
// Flip ONE switch (PLURAL) to swap the entire site between:
//   • "XtraPoint"  / xtrapoint.com   (PLURAL = false)
//   • "XtraPoints" / xtrapoints.com  (PLURAL = true)
//
// This drives the brand name in copy, the domain, all public emails, and which
// logo artwork (singular vs plural) is rendered. Change it here and nowhere else.
// =============================================================================

/** The only switch: false → "XtraPoint", true → "XtraPoints". */
export const PLURAL = false;

const domain = PLURAL ? "xtrapoints.com" : "xtrapoint.com";

export const brand = {
  plural: PLURAL,

  /** One-word wordmark, e.g. "XtraPoint" (used in UI labels, subjects, alt). */
  name: PLURAL ? "XtraPoints" : "XtraPoint",
  /** Two-word form used in body copy, e.g. "Xtra Point". */
  nameSpaced: PLURAL ? "Xtra Points" : "Xtra Point",

  domain,
  url: `https://${domain}`,
  /** Separate existing product-app subdomain (do not repurpose). */
  appUrl: `https://app.${domain}`,
  /** Bare domain for display, e.g. in the dashboard mock URL bar. */
  appHost: `app.${domain}`,

  /** Public sales inbox. The contact form should also deliver here. */
  salesEmail: `sales@${domain}`,

  tagline: "For the team behind the team",

  // Logo artwork swaps with the name (singular vs plural lockup).
  logo: {
    white: PLURAL
      ? "/assets/xtrapoints-logo-white.svg"
      : "/assets/xtrapoint-logo-white.svg",
    navy: PLURAL
      ? "/assets/xtrapoints-logo-navy.svg"
      : "/assets/xtrapoint-logo-navy.svg",
    // Native SVG dimensions, for correct aspect ratio / no layout shift.
    width: PLURAL ? 1073 : 1010,
    height: 182,
  },
} as const;

export default brand;
