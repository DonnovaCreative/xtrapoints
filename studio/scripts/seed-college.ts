// Auto-seed a COLLEGE as a review-ready DRAFT by pulling public data.
//
//   cd studio
//   COLLEGE="Sam Houston State" npm run seed:college       # one college
//   IMPORT_FILE=../import/colleges.txt npm run seed:college # one name per line
//
// Sources: ESPN's public team API (no key) for mascot + primary color + logo.
// Optionally enriches official name/city/state from College Scorecard if
// DATAGOV_API_KEY is set (free key at api.data.gov). Always creates DRAFTS —
// nothing goes live until an editor reviews and publishes in the Studio.
//
// Known limits (by design): ESPN colors are approximate (confirm against the
// official brand), the dark "ink" color is a placeholder, and the logo is an
// UNVERIFIED preview — replace it with the partner-approved logo before publish.
// K-12 schools aren't in ESPN and must be added via the Studio / import instead.
import { readFile } from "node:fs/promises";
import { getClient, slugify, color, uploadImage, writeSchool } from "./_lib.ts";

interface EspnTeam {
  displayName: string;
  name: string; // mascot, e.g. "Bearkats"
  location: string; // e.g. "Sam Houston"
  color?: string;
  logos?: { href: string }[];
}

const client = getClient();

async function espnTeams(): Promise<EspnTeam[]> {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000",
  );
  const data = await res.json();
  return data.sports[0].leagues[0].teams.map((t: { team: EspnTeam }) => t.team);
}

/** Optional: official name/city/state from College Scorecard (needs a key). */
async function scorecard(name: string) {
  const key = process.env.DATAGOV_API_KEY;
  if (!key) return null;
  const url = new URL("https://api.data.gov/ed/collegescorecard/v1/schools");
  url.searchParams.set("school.name", name);
  url.searchParams.set("fields", "school.name,school.city,school.state");
  url.searchParams.set("per_page", "1");
  url.searchParams.set("api_key", key);
  const res = await fetch(url);
  if (!res.ok) return null;
  const r = (await res.json())?.results?.[0];
  return r
    ? { name: r["school.name"], city: r["school.city"], state: r["school.state"] }
    : null;
}

async function seedOne(teams: EspnTeam[], query: string) {
  const q = query.toLowerCase();
  const matches = teams.filter(
    (t) =>
      t.displayName.toLowerCase().includes(q) ||
      t.location.toLowerCase().includes(q),
  );
  if (matches.length === 0) {
    console.log(`  ✗ "${query}": no ESPN match (K-12 / non-football? add via Studio or import).`);
    return;
  }
  if (matches.length > 1) {
    console.log(`  ! "${query}": ${matches.length} matches — narrow the name:`);
    matches.slice(0, 8).forEach((m) => console.log(`      • ${m.displayName}`));
    return;
  }

  const t = matches[0];
  const mascot = t.name;
  const enriched = await scorecard(query);
  const name = enriched?.name ?? t.displayName;
  const short = enriched?.name ?? t.location;
  const slug = slugify(short);
  const logoUrl = t.logos?.[0]?.href;
  const logo = logoUrl ? await uploadImage(client, logoUrl) : undefined;

  const body = {
    slug: { _type: "slug", current: slug },
    name,
    short,
    mascot,
    fund: `${mascot} Athletics Fund`,
    ...(enriched?.city ? { city: enriched.city } : {}),
    ...(enriched?.state ? { state: enriched.state } : {}),
    ...(logo ? { logo } : {}),
    theme: {
      primary: color(t.color) ?? color("#000000"),
      ink: color("#111827"), // placeholder — set the school's dark brand color
    },
  };

  await writeSchool(client, slug, body, false); // always a draft
  console.log(
    `  ✓ ${slug} (draft) — mascot="${mascot}" primary=#${t.color ?? "?"} logo=${logoUrl ? "preview" : "none"}`,
  );
}

async function run() {
  const single = process.env.COLLEGE;
  const file = process.env.IMPORT_FILE;
  let names: string[];
  if (single) names = [single];
  else if (file)
    names = (await readFile(file, "utf8"))
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  else
    throw new Error(
      `Set COLLEGE="Sam Houston State" or IMPORT_FILE=path/to/colleges.txt`,
    );

  console.log(`Auto-seeding ${names.length} college(s) from ESPN as drafts…`);
  const teams = await espnTeams();
  for (const n of names) await seedOne(teams, n);
  console.log(
    `Done. Review each draft at https://xtrapoint.sanity.studio — confirm name/city, set the dark "ink" color, replace the logo with the APPROVED file, then Publish.`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
