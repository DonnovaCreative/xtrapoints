// Static per-school Open Graph card: emits /schools/<slug>/og.png at build time
// (one file per registry entry). Wired into the page <head> via Layout's
// `ogImage` prop. See src/og/renderSchoolOg.ts for the design.
import type { APIRoute, GetStaticPaths } from "astro";
import { schools } from "@/data/schools";
import { renderSchoolOg } from "@/og/renderSchoolOg";

export const getStaticPaths: GetStaticPaths = () =>
  schools.map((school) => ({ params: { school: school.slug }, props: { school } }));

export const GET: APIRoute = async ({ props }) => {
  const png = await renderSchoolOg(props.school);
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
