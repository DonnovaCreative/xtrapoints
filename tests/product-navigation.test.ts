import assert from "node:assert/strict";
import { test } from "node:test";
import { marketingHrefForSlug } from "../src/lib/productNavigation.ts";

test("school navigation preserves distinct canonical school addresses", () => {
  const slugs = ["oregon", "oregon-ducks", "oregon-state", "example-state", "school-42", "a", "a".repeat(96)];
  for (const slug of slugs) {
    assert.equal(marketingHrefForSlug(slug), `/portal/${slug}`);
  }
});

test("remembered state cannot become an external URL or another portal route", () => {
  const inputs = [
    "https://example.com", "//example.com", "javascript:alert(1)",
    "/portal/oregon", "portal/oregon", "../account", "oregon/../account",
    "oregon\\..\\account", "oregon?redirect_url=https://example.com", "oregon#brand",
    "%2e%2e%2faccount", "oregon%2faccount", "account",
  ];
  for (const input of inputs) assert.equal(marketingHrefForSlug(input), undefined, input);
});

test("legacy bearer credentials are never used as remembered school navigation", () => {
  for (const token of ["0123456789abcdef0123456789abcdef", "a".repeat(32), "0".repeat(32)]) {
    assert.equal(marketingHrefForSlug(token), undefined);
    assert.equal(marketingHrefForSlug(`/portal/${token}`), undefined);
  }
});

test("invalid or noncanonical browser state falls back instead of being normalized", () => {
  const inputs: unknown[] = [
    undefined, null, false, 42, [], {}, { slug: "oregon" },
    "", "Oregon", " oregon", "oregon ", "oregon\n", "oregon\u0000",
    "-oregon", "oregon-", "oregon--ducks", "oregon_ducks", "orégon", "a".repeat(97),
  ];
  for (const input of inputs) assert.equal(marketingHrefForSlug(input), undefined);
});
