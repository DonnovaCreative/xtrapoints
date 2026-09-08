import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { lookupCollege } from "../src/lib/collegeSeed.ts";

// Names and IDs from ESPN. Mary/Maryland and Oregon/Oregon State reproduced
// the selection loop: choosing the full name still returned multiple matches.
const teams = [
  { id: "120", displayName: "Maryland Terrapins", name: "Terrapins", location: "Maryland", color: "D5002B" },
  { id: "559", displayName: "University of Mary Marauders", name: "Marauders", location: "University of Mary" },
  { id: "2483", displayName: "Oregon Ducks", name: "Ducks", location: "Oregon" },
  { id: "204", displayName: "Oregon State Beavers", name: "Beavers", location: "Oregon State" },
];

const originalFetch = globalThis.fetch;
const originalScorecardKey = process.env.DATAGOV_API_KEY;

function mockTeams(list = teams) {
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "https://site.api.espn.com/apis/site/v2/sports/football/college-football/teams?limit=1000");
    return Response.json({ sports: [{ leagues: [{ teams: list.map((team) => ({ team })) }] }] });
  };
}

beforeEach(() => {
  delete process.env.DATAGOV_API_KEY;
  mockTeams();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalScorecardKey === undefined) delete process.env.DATAGOV_API_KEY;
  else process.env.DATAGOV_API_KEY = originalScorecardKey;
});

test("Maryland Terrapins resolves directly instead of also matching University of Mary", async () => {
  const result = await lookupCollege("Maryland Terrapins");
  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.match, "Maryland Terrapins");
  assert.equal(result.fields.mascot, "Terrapins");
  assert.equal(result.fields.short, "Maryland");
  assert.equal(result.fields.slug, "maryland");
  assert.equal(result.fields.theme.primary, "#d5002b");
});

test("exact school locations take precedence over partial names", async () => {
  for (const query of ["Maryland", "University of Maryland", "  MARYLAND!!  "]) {
    const result = await lookupCollege(query);
    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.match, "Maryland Terrapins");
  }
});

test("Oregon State does not also resolve to Oregon", async () => {
  for (const query of ["Oregon State", "Oregon State Beavers"]) {
    const result = await lookupCollege(query);
    assert.equal(result.status, "ok");
    if (result.status === "ok") assert.equal(result.match, "Oregon State Beavers");
  }
});

test("broad queries return individually selectable ESPN IDs", async () => {
  const result = await lookupCollege("mar");
  assert.deepEqual(result, {
    status: "ambiguous",
    candidates: [
      { id: "120", displayName: "Maryland Terrapins" },
      { id: "559", displayName: "University of Mary Marauders" },
    ],
  });
});

test("every candidate from a broad search can be selected by ID", async () => {
  const result = await lookupCollege("mar");
  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  for (const candidate of result.candidates) {
    const selected = await lookupCollege("mar", candidate.id);
    assert.equal(selected.status, "ok");
    if (selected.status === "ok") assert.equal(selected.match, candidate.displayName);
  }
});

test("an explicit ID wins over the query text", async () => {
  const result = await lookupCollege("Maryland Terrapins", "559");
  assert.equal(result.status, "ok");
  if (result.status === "ok") assert.equal(result.match, "University of Mary Marauders");
});

test("ID-only lookup needs no name or fuzzy matching", async () => {
  const result = await lookupCollege("", "120");
  assert.equal(result.status, "ok");
  if (result.status === "ok") assert.equal(result.match, "Maryland Terrapins");
});

test("unknown IDs never fall back to a different school from the query", async () => {
  assert.deepEqual(await lookupCollege("Maryland Terrapins", "999999"), { status: "none" });
});

test("a location inside a longer query must match whole words", async () => {
  mockTeams([teams[1]]);
  assert.deepEqual(await lookupCollege("Maryland Terrapins"), { status: "none" });
});

test("normalization that leaves no search text does not match every team", async () => {
  for (const query of ["", "  ", "!!!", "University of the"]) {
    assert.deepEqual(await lookupCollege(query), { status: "none" });
  }
});

test("no matching school returns none", async () => {
  assert.deepEqual(await lookupCollege("No Such School"), { status: "none" });
});

test("all candidates remain reachable when more than 15 schools match", async () => {
  mockTeams(Array.from({ length: 20 }, (_, i) => ({
    id: String(i), displayName: `Test College ${i} Tigers`, location: `Test College ${i}`, name: "Tigers",
  })));
  const result = await lookupCollege("Test College");
  assert.equal(result.status, "ambiguous");
  if (result.status !== "ambiguous") return;
  assert.equal(result.candidates.length, 20);
  const selected = await lookupCollege("Test College", result.candidates[19].id);
  assert.equal(selected.status, "ok");
  if (selected.status === "ok") assert.equal(selected.match, "Test College 19 Tigers");
});

test("duplicate display names can still be disambiguated by ID", async () => {
  mockTeams([{ ...teams[0], id: "1" }, { ...teams[0], id: "2" }]);
  assert.equal((await lookupCollege("Maryland Terrapins")).status, "ambiguous");
  assert.equal((await lookupCollege("Maryland Terrapins", "2")).status, "ok");
});

test("ESPN failure is surfaced instead of pretending there are no matches", async () => {
  globalThis.fetch = async () => new Response(null, { status: 503 });
  await assert.rejects(lookupCollege("Maryland Terrapins"), /ESPN API returned 503/);
});
