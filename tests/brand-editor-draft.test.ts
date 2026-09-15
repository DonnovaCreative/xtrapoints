import assert from "node:assert/strict";
import { test } from "node:test";
import { brandDraftChanges, refreshBrandDraft, type BrandSnapshot } from "../src/components/portal/brandEditorDraft.ts";

const original: BrandSnapshot = {
  revision: "r1", colors: { primary: "#123456", secondary: null }, images: { logo: "old-logo" },
  credits: { team: "Original", fans: null },
};
const initialize = () => refreshBrandDraft(null, original, ["primary", "secondary"], ["team", "fans"]);

test("an image upload refreshes the revision and preview while preserving unsaved colors and credits", () => {
  const draft = initialize();
  draft.colors.primary = "#abcdef";
  draft.credits.team = "Updated credit";
  const next = refreshBrandDraft(draft, { ...original, revision: "r2", images: { logo: "new-logo" } }, ["primary", "secondary"], ["team", "fans"]);
  assert.equal(next.saved.revision, "r2");
  assert.equal(next.saved.images.logo, "new-logo");
  assert.equal(next.colors.primary, "#abcdef");
  assert.equal(next.credits.team, "Updated credit");
  assert.deepEqual(brandDraftChanges(next), { colors: true, credits: true });
});

test("saving colors accepts the server's normalized values and preserves unsaved credits", () => {
  const draft = initialize();
  draft.colors.primary = "#ABCDEF";
  draft.credits.team = "New photographer";
  const next = refreshBrandDraft(draft, { ...original, colors: { ...original.colors, primary: "#abcdef" } }, ["primary", "secondary"], ["team", "fans"], { colors: { ...draft.colors } });
  assert.equal(next.colors.primary, "#abcdef");
  assert.equal(next.credits.team, "New photographer");
  assert.deepEqual(brandDraftChanges(next), { colors: false, credits: true });
});

test("saving one credit preserves other credits and colors", () => {
  const draft = initialize();
  draft.colors.primary = "#654321";
  draft.credits.team = " Photographer ";
  draft.credits.fans = "Another photographer";
  const next = refreshBrandDraft(draft, { ...original, credits: { ...original.credits, team: "Photographer" } }, ["primary", "secondary"], ["team", "fans"], { credits: { team: " Photographer " } });
  assert.equal(next.credits.team, "Photographer");
  assert.equal(next.credits.fans, "Another photographer");
  assert.equal(next.colors.primary, "#654321");
});

test("a response cannot replace edits made after the submitted values were captured", () => {
  const draft = initialize();
  draft.colors.primary = "#333333";
  const next = refreshBrandDraft(draft, { ...original, colors: { primary: "#222222" } }, ["primary", "secondary"], ["team", "fans"], { colors: { primary: "#222222" } });
  assert.equal(next.colors.primary, "#333333");
  assert.equal(brandDraftChanges(next).colors, true);
});

test("clean fields follow newer server values and absent values remain clean", () => {
  const next = refreshBrandDraft(initialize(), { ...original, colors: { primary: "#ffffff" }, credits: { team: null } }, ["primary", "secondary"], ["team", "fans"]);
  assert.equal(next.colors.primary, "#ffffff");
  assert.equal(next.colors.secondary, "");
  assert.equal(next.credits.team, "");
  assert.deepEqual(brandDraftChanges(next), { colors: false, credits: false });
});

test("a concurrently removed photo retains its unsaved credit for explicit recovery", () => {
  const saved = { revision: "r1", colors: {}, images: { "photos.team": "https://example.test/team.png" }, credits: { "photos.team": "Original" } };
  const model = refreshBrandDraft(null, saved, [], ["photos.team"]);
  model.credits["photos.team"] = "Unfinished credit";
  const next = refreshBrandDraft(model, { revision: "r2", colors: {}, images: {}, credits: {} }, [], ["photos.team"]);
  assert.equal(next.saved.images["photos.team"], undefined);
  assert.equal(next.credits["photos.team"], "Unfinished credit");
  assert.equal(brandDraftChanges(next).credits, true);
  next.credits["photos.team"] = next.saved.credits?.["photos.team"] ?? "";
  assert.equal(brandDraftChanges(next).credits, false);
});
