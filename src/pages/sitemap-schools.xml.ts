import type { APIRoute } from "astro";
import { getSchools } from "@/data/schoolsSource";
import { brand } from "@/config/brand";
export const prerender = false;
const escapeXml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const GET: APIRoute = async () => {
  const schools = await getSchools();
  const paths = schools.flatMap((s) =>
    [
      s.livePages.donor ? `/schools/${s.slug}` : null,
      s.livePages.ambassador ? `/schools/${s.slug}/ambassadors` : null,
    ].filter(Boolean),
  );
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${[...new Set(paths)].map((path) => `<url><loc>${escapeXml(new URL(path!, brand.url).href)}</loc></url>`).join("")}</urlset>`;
  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "CDN-Cache-Control": "public, max-age=30",
    },
  });
};
