import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeSchoolDirectoryRows } from "../src/lib/schoolDirectoryRows.ts";

const canonical = { _id: "school.example", name: "Published name", logo: "https://assets.example/published.png" };
const draft = { _id: "drafts.school.example", name: "Updated name", logo: "https://assets.example/draft.svg" };

test("a draft wins regardless of its position relative to the canonical row", () => {
  assert.deepEqual(mergeSchoolDirectoryRows([canonical, draft]), [draft]);
  assert.deepEqual(mergeSchoolDirectoryRows([draft, canonical]), [draft]);
});

test("split cursor pages preserve the loaded draft without moving other partners", () => {
  const other = { _id: "school.other", name: "Other school", logo: "https://assets.example/other.png" };
  const firstPage = [draft, other];
  const nextPage = [canonical];
  assert.deepEqual(mergeSchoolDirectoryRows([...firstPage, ...nextPage]), [draft, other]);
  assert.deepEqual(mergeSchoolDirectoryRows([...mergeSchoolDirectoryRows(firstPage), ...nextPage]), [draft, other]);
  assert.deepEqual(mergeSchoolDirectoryRows([canonical, other, draft]), [draft, other]);
});

test("removing draft images does not revive a later canonical thumbnail", () => {
  const removed = { ...draft, logo: null };
  assert.deepEqual(mergeSchoolDirectoryRows([removed, canonical]), [removed]);
  assert.deepEqual(mergeSchoolDirectoryRows([canonical, removed]), [removed]);
});

test("repeated rows of the same version refresh in place without mutating inputs", () => {
  const updated = { ...draft, logo: null };
  const input = Object.freeze([Object.freeze(draft), Object.freeze(updated)]);
  assert.deepEqual(mergeSchoolDirectoryRows(input), [updated]);
  assert.equal(input[0].logo, "https://assets.example/draft.svg");
});

test("different partner IDs sharing a slug remain distinct", () => {
  const first = { _id: "drafts.school.oregon", slug: "oregon" };
  const second = { _id: "drafts.school.university-of-oregon", slug: "oregon" };
  assert.deepEqual(mergeSchoolDirectoryRows([first, second]), [first, second]);
});
