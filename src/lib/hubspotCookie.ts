// Client-side helper: read HubSpot's `hubspotutk` tracking cookie.
//
// HubSpot sets this cookie from its tracking script and uses it to stitch a form
// submission onto everything that browser did beforehand — which pages they read,
// how they found you. Forwarding it turns a bare contact record into an
// attributed one.
//
// It is ABSENT more often than you'd expect, and that is normal, not an error:
//   • the visitor declined cookies (the banner gates the tracking script),
//   • they're on staging or local, where the script never loads at all
//     (see src/layouts/Layout.astro — production only),
//   • it's their first page view and the script hasn't run yet.
// Callers must treat "" as an ordinary outcome; src/lib/hubspot.ts omits the
// field entirely rather than sending an empty one, which HubSpot rejects.
export function hubspotCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|;\s*)hubspotutk=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}
