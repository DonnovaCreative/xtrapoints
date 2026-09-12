import assert from "node:assert/strict";
import { test } from "node:test";
import { canShowAboutPreview } from "../src/lib/aboutPreview.ts";

test("About drafts are blocked in production even with a spoofed preview or local host", () => {
  for (const hostname of [
    "xtrapoint.com",
    "staging.xtrapoint.com",
    "project.vercel.app",
    "localhost",
  ]) {
    assert.equal(
      canShowAboutPreview({
        environment: "production",
        hostname,
        development: true,
      }),
      false,
    );
  }
});

test("production domains cannot display About drafts from a preview build", () => {
  for (const hostname of [
    "xtrapoint.com",
    "www.xtrapoint.com",
    "xtrapoints.com",
    "www.xtrapoints.com",
    "XTRAPOINT.COM.",
  ]) {
    assert.equal(
      canShowAboutPreview({ environment: "preview", hostname }),
      false,
    );
  }
});

test("About drafts are allowed on staging and Vercel previews", () => {
  assert.equal(
    canShowAboutPreview({
      environment: "preview",
      hostname: "staging.xtrapoint.com",
    }),
    true,
  );
  assert.equal(
    canShowAboutPreview({
      environment: "preview",
      hostname: "project.vercel.app",
    }),
    true,
  );
  assert.equal(
    canShowAboutPreview({
      environment: "staging",
      hostname: "staging.xtrapoint.com",
    }),
    true,
  );
});

test("missing and unknown deployment environments fail closed", () => {
  for (const environment of [undefined, "", "custom", "development"]) {
    assert.equal(
      canShowAboutPreview({ environment, hostname: "staging.xtrapoint.com" }),
      false,
    );
    assert.equal(
      canShowAboutPreview({ environment, hostname: "localhost" }),
      false,
    );
  }
});

test("local authoring requires the development flag and a loopback hostname", () => {
  assert.equal(
    canShowAboutPreview({
      environment: undefined,
      hostname: "localhost",
      development: true,
    }),
    true,
  );
  assert.equal(
    canShowAboutPreview({
      environment: undefined,
      hostname: "[::1]",
      development: true,
    }),
    true,
  );
  assert.equal(
    canShowAboutPreview({
      environment: undefined,
      hostname: "example.com",
      development: true,
    }),
    false,
  );
});
