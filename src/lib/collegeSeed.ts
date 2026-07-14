// College auto-seed lookup — the browser/serverless counterpart of the terminal
// script `studio/scripts/seed-college.ts`. Pulls a college's mascot, brand color,
// (optional) city/state, and logo URL from public sources so the Studio can
// prefill a new school draft. Used by src/pages/api/seed-college.ts.
//
// Sources: ESPN's public college-football team API (no key) + optional College
// Scorecard enrichment (needs DATAGOV_API_KEY server-side). Colleges only; ESPN
// colors are approximate and the logo is an UNVERIFIED preview.

const env = (k: string): string | undefined =>
  (import.meta.env as Record<string, string | undefined>)[k] ??
  process.env[k];

interface EspnTeam {
  displayName: string;
  name: string; // mascot, e.g. "Bearkats"
  location: string; // e.g. "Sam Houston"
  color?: string;
  alternateColor?: string;
  logos?: { href: string }[];
}

export interface CollegeSeedFields {
  name: string;
  short: string;
  slug: string;
  mascot: string;
  fund: string;
  city?: string;
  state?: string;
  theme: {
    primary: string;
    secondary?: string;
    ink: string;
  };
}

export type LookupResult =
  | { status: "none" }
  | { status: "ambiguous"; candidates: string[] }
  | { status: "ok"; match: string; fields: CollegeSeedFields; logoUrl?: string };

// ESPN's alternateColor is often just white/black — only use it as a real
// secondary brand color.
const usableSecondary = (hex?: string): string | undefined => {
  const h = hex?.toLowerCase().replace(/^#/, "");
  if (!h || !/^[0-9a-f]{6}$/.test(h)) return undefined;
  return ["ffffff", "000000", "fefefe", "010101"].includes(h) ? undefined : `#${h}`;
};

const withHash = (hex?: string): string | undefined => {
  const h = hex?.toLowerCase().replace(/^#/, "");
  return h && /^[0-9a-f]{6}$/.test(h) ? `#${h}` : undefined;
};

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Normalize for fuzzy matching: drop punctuation and filler words like
// "University of" so "University of Oregon" matches ESPN's "Oregon".
const norm = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(university|univ|of|the|at)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function espnTeams(): Promise<EspnTeam[]> {
  const res = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000",
  );
  if (!res.ok) throw new Error(`ESPN API returned ${res.status}`);
  const data = await res.json();
  return data.sports[0].leagues[0].teams.map((t: { team: EspnTeam }) => t.team);
}

function findMatches(teams: EspnTeam[], query: string): EspnTeam[] {
  const nq = norm(query);
  if (!nq) return [];
  return teams.filter((t) => {
    const nd = norm(t.displayName);
    const nl = norm(t.location);
    return nd.includes(nq) || nl.includes(nq) || nq.includes(nl);
  });
}

// Optional official name/city/state from College Scorecard (needs
// DATAGOV_API_KEY). Prefers the result whose name normalizes exactly to the
// team's location ("Oregon" → "University of Oregon"), else the top result.
async function scorecard(location: string) {
  const key = env("DATAGOV_API_KEY");
  if (!key) return null;
  const url = new URL("https://api.data.gov/ed/collegescorecard/v1/schools");
  url.searchParams.set("school.name", location);
  url.searchParams.set("fields", "school.name,school.city,school.state");
  url.searchParams.set("per_page", "25");
  url.searchParams.set("api_key", key);
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const results: Array<Record<string, string>> = (await res.json())?.results ?? [];
    if (!results.length) return null;
    const target = norm(location);
    const best =
      results.find((r) => norm(r["school.name"] ?? "") === target) ?? results[0];
    return {
      name: best["school.name"],
      city: best["school.city"],
      state: best["school.state"],
    };
  } catch {
    return null;
  }
}

/** Look up one college by name/team; returns a prefill payload or a disambiguation list. */
export async function lookupCollege(query: string): Promise<LookupResult> {
  const teams = await espnTeams();
  const matches = findMatches(teams, query);
  if (matches.length === 0) return { status: "none" };
  if (matches.length > 1) {
    return {
      status: "ambiguous",
      candidates: matches.slice(0, 15).map((m) => m.displayName),
    };
  }

  const t = matches[0];
  const mascot = t.name;
  const enriched = await scorecard(t.location);
  const name = enriched?.name ?? t.displayName;
  const short = t.location;
  const secondary = usableSecondary(t.alternateColor);

  return {
    status: "ok",
    match: t.displayName,
    logoUrl: t.logos?.[0]?.href,
    fields: {
      name,
      short,
      slug: slugify(short),
      mascot,
      fund: `${mascot} Athletics Fund`,
      ...(enriched?.city ? { city: enriched.city } : {}),
      ...(enriched?.state ? { state: enriched.state } : {}),
      theme: {
        primary: withHash(t.color) ?? "#000000",
        ...(secondary ? { secondary } : {}),
        ink: "#111827", // placeholder — editor sets the school's dark brand color
      },
    },
  };
}
