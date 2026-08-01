// Default Ambassador page tiers/recognition cards — mirrors the fallback copy
// in the site's SchoolAmbassadors.astro (DEFAULT_TIERS/DEFAULT_PROGRAMS; the
// site and Studio are separate builds so the copy is kept in sync by hand, see
// docs/DECISIONS.md). Used in two places here:
//   - `initialValue` on school.ambassadorTiers/ambassadorPrograms, so a NEW
//     school created in the Studio (or via seed-college.ts/import.ts, wired
//     through scripts/_lib.ts's writeSchool) starts pre-filled.
//   - scripts/backfill-ambassador-defaults.ts, a one-time migration that
//     fills these fields on schools created before the fields existed.
// Object array members need `_key` (+ `_type` matching the array member's
// `name` in the schema) for the Studio's array editor.
export const DEFAULT_AMBASSADOR_TIERS = [
  {
    _key: "bronze",
    _type: "tier",
    name: "Bronze",
    role: "Getting started",
    perks: ["Welcome kit", "Branded apparel & swag", "Digital recognition + LinkedIn badge"],
    highlight: false,
  },
  {
    _key: "silver",
    _type: "tier",
    name: "Silver",
    role: "Consistent contributor",
    perks: ["Premium apparel", "Early access", "Gift cards", "Social spotlight"],
    highlight: false,
  },
  {
    _key: "gold",
    _type: "tier",
    name: "Gold",
    role: "Top performer & leader",
    perks: ["VIP experiences", "Networking events", "Leadership recognition", "Internship consideration"],
    highlight: true,
  },
];

export const DEFAULT_AMBASSADOR_PROGRAMS = [
  {
    _key: "leaderboards",
    _type: "program",
    title: "Leaderboards",
    body: "Friendly competition across campus.",
  },
  {
    _key: "ambassador-of-month",
    _type: "program",
    title: "Ambassador of the Month",
    body: "Plus recurring social spotlights.",
  },
  {
    _key: "end-of-year",
    _type: "program",
    title: "End-of-year recognition",
    body: "A banquet celebrating top ambassadors.",
  },
  {
    _key: "seasonal",
    _type: "program",
    title: "Seasonal campaigns",
    body: "Tied to football, basketball, orientation & giving days.",
  },
];
