/**
 * The unfinished company page is deliberately available only in development
 * and known Vercel preview environments. A missing/unknown deployment setting
 * must not publish draft people, partner, or recognition content.
 *
 * The environment check is authoritative. Request hostnames can only deny
 * access, never grant it, so changing a Host header cannot unlock production.
 */
export function canShowAboutPreview({
  environment,
  hostname,
  development = false,
}: {
  environment: string | undefined;
  hostname: string;
  development?: boolean;
}): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const productionHosts = new Set([
    "xtrapoint.com",
    "www.xtrapoint.com",
    "xtrapoints.com",
    "www.xtrapoints.com",
  ]);

  if (environment === "production" || productionHosts.has(host)) return false;
  if (environment === "preview" || environment === "staging") return true;

  // Local development is useful for authoring; a normal build with no Vercel
  // environment still fails closed, even if its request hostname is localhost.
  return (
    development &&
    !environment &&
    ["localhost", "127.0.0.1", "[::1]", "::1"].includes(host)
  );
}
