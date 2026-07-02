// =============================================================================
// SCHOOL CONTENT SOURCE — the single swap-point for WHERE co-branded school
// data comes from. Page templates and the OG endpoint only ever call
// getSchools()/getSchool(); they never import the raw data directly.
//
// Phase 1 (now): reads the in-repo `schools` array from ./schools.ts.
// Phase 2:       replace these two function bodies with GROQ queries against
//                Sanity — no page template or endpoint needs to change.
//
// The functions are async on purpose so the Sanity swap is a body-only edit.
// =============================================================================
import { schools, type School } from "@/data/schools";

/** All schools, in registry order. */
export async function getSchools(): Promise<School[]> {
  return schools;
}

/** One school by slug, or undefined if there's no match. */
export async function getSchool(slug: string): Promise<School | undefined> {
  return schools.find((s) => s.slug === slug);
}
