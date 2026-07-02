// One-time migration: import the existing schools + their local assets
// (../public/assets/...) into Sanity as `school` documents.
//
// Run from the studio/ folder, after `sanity login`:
//   npm run seed
// (which is: sanity exec scripts/seed.ts --with-user-token)
//
// The school data is inlined below (rather than imported from the site's
// src/data/schools.ts) because `sanity exec` runs this through Node's ESM
// loader, which can't resolve a .ts module outside this package. It's a one-off,
// so a small copy is fine. Only primary/ink/onAccent are set — the deep/dark/
// soft accent shades are DERIVED on the site.
//
// Idempotent: deterministic _ids (`school.<slug>`) + createOrReplace, so
// re-running updates the docs. NOTE it re-uploads image assets each run — don't
// loop it.
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

// `sanity/cli` is CommonJS; under Node's type-stripping ESM loader a named
// `import { getCliClient }` fails ("does not provide an export named ..."), so
// load it through require for reliable CJS interop. --with-user-token still
// supplies the auth via getCliClient().
const require = createRequire(import.meta.url);
const { getCliClient } = require("sanity/cli");

interface SeedSchool {
  slug: string;
  name: string;
  short: string;
  mascot: string;
  fund: string;
  city: string;
  state: string;
  logo?: string;
  logoBadge?: boolean;
  logoClass?: string;
  mark?: string;
  avatar?: string;
  photos?: Partial<
    Record<"team" | "fans" | "celebrate" | "mascot" | "action", string>
  >;
  theme: { primary: string; ink: string; onAccent?: string };
}

// Mirror of the two live entries in src/data/schools.ts (colors: primary + ink
// + optional onAccent only — the rest are derived on the site).
const SEED: SeedSchool[] = [
  {
    slug: "sam-houston",
    name: "Sam Houston State University",
    short: "Sam Houston State",
    mascot: "Bearkats",
    fund: "Bearkat Athletics Fund",
    city: "Huntsville",
    state: "TX",
    logo: "/assets/schools/sam-houston/logo-white.svg",
    mark: "/assets/schools/sam-houston/paw.svg",
    photos: {
      team: "/assets/schools/sam-houston/team.webp",
      fans: "/assets/schools/sam-houston/fans.jpg",
      celebrate: "/assets/schools/sam-houston/celebrate.jpg",
      mascot: "/assets/schools/sam-houston/mascot.jpg",
      action: "/assets/schools/sam-houston/action.jpg",
    },
    theme: { primary: "#ff5200", ink: "#1e1d23" },
  },
  {
    slug: "westminster",
    name: "Westminster Academy",
    short: "Westminster Academy",
    mascot: "Lions",
    fund: "Lions Athletics Fund",
    city: "Fort Lauderdale",
    state: "FL",
    logo: "/assets/schools/westminster/logo-white.png",
    logoClass: "h-8 w-auto",
    avatar: "/assets/schools/westminster/avatar.png",
    photos: {
      team: "/assets/schools/westminster/team.jpg",
      fans: "/assets/schools/westminster/fans.jpg",
      celebrate: "/assets/schools/westminster/celebrate.webp",
      mascot: "/assets/schools/westminster/mascot.jpg",
      action: "/assets/schools/westminster/action.jpg",
    },
    theme: { primary: "#e51937", ink: "#002a5c", onAccent: "#ffffff" },
  },
];

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

const color = (hex?: string) => (hex ? { _type: "color", hex } : undefined);

async function seed() {
  try {
    await access(publicPath("/assets"));
  } catch {
    throw new Error(
      `Can't find the site's public/assets at ${publicPath("/assets")}. ` +
        `Run this from the studio/ folder (npm run seed).`,
    );
  }

  const cfg = client.config();
  console.log(
    `Client → project=${cfg.projectId} dataset=${cfg.dataset} ` +
      `token=${cfg.token ? "yes" : "NO"} perspective=${cfg.perspective ?? "(default)"}`,
  );

  for (const s of SEED) {
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

    const res = await client.createOrReplace(doc);
    console.log(`  ✓ ${s.slug} → _id=${res._id} _rev=${res._rev}`);
  }

  // Self-verify with the same authenticated client (bypasses any perspective/
  // draft ambiguity): how many published `school` docs actually exist now?
  const count = await client.fetch('count(*[_type == "school"])');
  console.log(`Done — dataset now reports ${count} published school doc(s).`);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
