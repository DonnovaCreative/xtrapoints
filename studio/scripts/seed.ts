// One-time migration: import the existing in-repo schools (src/data/schools.ts)
// and their local assets (public/assets/...) into Sanity as `school` documents.
//
// Run from the studio/ folder, after `sanity login`:
//   npm run seed
// (which is: sanity exec scripts/seed.ts --with-user-token)
//
// Idempotent: uses deterministic _ids (`school.<slug>`) + createOrReplace, so
// re-running updates the docs rather than duplicating them. NOTE it re-uploads
// the image assets each run — fine for a one-off; don't loop it.
import { getCliClient } from "sanity/cli";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { schools } from "../../src/data/schools";

const client = getCliClient({ apiVersion: "2025-01-01" });

// Run from studio/, so the site repo root is one level up.
const repoRoot = path.resolve(process.cwd(), "..");
const publicPath = (url: string) =>
  path.join(repoRoot, "public", url.replace(/^\//, ""));

const contentTypeFor = (file: string): string =>
  file.endsWith(".svg")
    ? "image/svg+xml"
    : file.endsWith(".png")
      ? "image/png"
      : file.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

async function uploadImage(url: string) {
  const abs = publicPath(url);
  const buf = await readFile(abs);
  const filename = path.basename(abs);
  const asset = await client.assets.upload("image", buf, {
    filename,
    contentType: contentTypeFor(filename),
  });
  return { _type: "image", asset: { _type: "reference", _ref: asset._id } };
}

const color = (hex?: string) =>
  hex ? { _type: "color", hex } : undefined;

async function seed() {
  // Fail fast with a clear message if we're not being run from studio/.
  try {
    await access(publicPath("/assets"));
  } catch {
    throw new Error(
      `Can't find the site's public/assets at ${publicPath("/assets")}. ` +
        `Run this from the studio/ folder (npm run seed).`,
    );
  }

  for (const s of schools) {
    console.log(`Seeding ${s.slug}…`);
    const [logo, mark, avatar] = await Promise.all([
      s.logo ? uploadImage(s.logo) : undefined,
      s.mark ? uploadImage(s.mark) : undefined,
      s.avatar ? uploadImage(s.avatar) : undefined,
    ]);

    const photos: Record<string, unknown> = {};
    for (const key of ["team", "fans", "celebrate", "mascot", "action"] as const) {
      const p = s.photos?.[key];
      if (p) photos[key] = await uploadImage(p);
    }

    const doc = {
      _id: `school.${s.slug}`,
      _type: "school",
      slug: { _type: "slug", current: s.slug },
      name: s.name,
      short: s.short,
      mascot: s.mascot,
      fund: s.fund,
      city: s.city,
      state: s.state,
      ...(logo ? { logo } : {}),
      ...(s.logoBadge ? { logoBadge: true } : {}),
      ...(s.logoClass ? { logoClass: s.logoClass } : {}),
      ...(mark ? { mark } : {}),
      ...(avatar ? { avatar } : {}),
      ...(Object.keys(photos).length ? { photos } : {}),
      theme: {
        primary: color(s.theme.primary),
        ink: color(s.theme.ink),
        ...(s.theme.onAccent ? { onAccent: color(s.theme.onAccent) } : {}),
      },
    };

    await client.createOrReplace(doc);
    console.log(`  ✓ ${s.slug}`);
  }
  console.log(`Done — seeded ${schools.length} school(s).`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
