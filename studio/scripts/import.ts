// Bulk-import schools into Sanity from a JSON manifest.
//
//   cd studio
//   IMPORT_FILE=../import/schools.json npm run import          # creates DRAFTS
//   IMPORT_FILE=../import/schools.json PUBLISH=1 npm run import # creates LIVE docs
//
// Manifest = a JSON array of entries. Image fields (logo/mark/avatar/photos.*)
// may be LOCAL paths (resolved from where you run the command) OR remote URLs.
// `slug`, `short`, and `fund` are optional (derived if omitted).
import { readFile } from "node:fs/promises";
import { getClient, slugify, color, uploadImage, writeSchool } from "./_lib.ts";

interface Row {
  slug?: string;
  name: string;
  short?: string;
  mascot: string;
  fund?: string;
  city?: string;
  state?: string;
  primary: string;
  ink: string;
  /** Optional second brand color for the two-tone atmospheric treatment. */
  secondary?: string;
  /** Text color ON the accent (defaults to ink; set white for mid/dark accents). */
  onAccent?: string;
  /** Only for very bright accents whose derived on-white shade isn't dark enough. */
  primaryDarkOverride?: string;
  logo?: string;
  /** ON for a COLORED logo → white badge so it reads on the dark header. */
  logoBadge?: boolean;
  /** Use a white header bar instead of the dark one (for colored logos). */
  whiteHeader?: boolean;
  /** Header logo size preset. */
  logoSize?: "sm" | "md" | "lg" | "xl";
  mark?: string;
  avatar?: string;
  photos?: Partial<
    Record<"team" | "fans" | "celebrate" | "mascot" | "action", string>
  >;
}

const client = getClient();

async function run() {
  const file = process.env.IMPORT_FILE;
  const publish = process.env.PUBLISH === "1";
  if (!file) throw new Error("Set IMPORT_FILE=path/to/schools.json");

  const rows: Row[] = JSON.parse(await readFile(file, "utf8"));
  console.log(
    `Importing ${rows.length} school(s) as ${publish ? "PUBLISHED (live)" : "drafts (review in Studio)"}…`,
  );

  for (const r of rows) {
    const slug = r.slug ?? slugify(r.short ?? r.name);
    const [logo, mark, avatar] = await Promise.all([
      r.logo ? uploadImage(client, r.logo) : undefined,
      r.mark ? uploadImage(client, r.mark) : undefined,
      r.avatar ? uploadImage(client, r.avatar) : undefined,
    ]);
    const photos: Record<string, unknown> = {};
    for (const k of ["team", "fans", "celebrate", "mascot", "action"] as const) {
      if (r.photos?.[k]) photos[k] = await uploadImage(client, r.photos[k]!);
    }

    const body = {
      slug: { _type: "slug", current: slug },
      name: r.name,
      short: r.short ?? r.name,
      mascot: r.mascot,
      fund: r.fund ?? `${r.mascot} Athletics Fund`,
      ...(r.city ? { city: r.city } : {}),
      ...(r.state ? { state: r.state } : {}),
      ...(logo ? { logo } : {}),
      ...(r.logoBadge ? { logoBadge: true } : {}),
      ...(r.whiteHeader ? { whiteHeader: true } : {}),
      ...(r.logoSize ? { logoSize: r.logoSize } : {}),
      ...(mark ? { mark } : {}),
      ...(avatar ? { avatar } : {}),
      ...(Object.keys(photos).length ? { photos } : {}),
      theme: {
        primary: color(r.primary),
        ink: color(r.ink),
        ...(r.secondary ? { secondary: color(r.secondary) } : {}),
        ...(r.onAccent ? { onAccent: color(r.onAccent) } : {}),
        ...(r.primaryDarkOverride
          ? { primaryDarkOverride: color(r.primaryDarkOverride) }
          : {}),
      },
    };

    await writeSchool(client, slug, body, publish);
    console.log(`  ✓ ${slug}${publish ? "" : " (draft)"}`);
  }
  console.log(`Done — ${rows.length} school(s) ${publish ? "published" : "created as drafts"}.`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
