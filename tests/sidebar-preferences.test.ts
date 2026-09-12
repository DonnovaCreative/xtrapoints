import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import {
  clampSidebarWidth,
  readSidebarPreferences,
  SIDEBAR_PREFERENCES_BOOTSTRAP,
  SIDEBAR_STORAGE_KEY,
} from "../src/lib/sidebarPreferences.ts";

test("sidebar preferences survive document navigation with both values preserved", () => {
  const saved = new Map([[SIDEBAR_STORAGE_KEY, JSON.stringify({ open: false, width: 384 })]]);
  assert.deepEqual(readSidebarPreferences({ getItem: (key) => saved.get(key) ?? null }), { open: false, width: 384 });
  assert.deepEqual(readSidebarPreferences(undefined, "sidebar_state=false; xp_sidebar_width=384"), { open: false, width: 384 });
});

test("blocked or malformed local storage falls back to cookies and safe defaults", () => {
  const blocked = { getItem() { throw new Error("Storage blocked"); } };
  assert.deepEqual(readSidebarPreferences(blocked, "sidebar_state=false; xp_sidebar_width=320"), { open: false, width: 320 });
  assert.deepEqual(readSidebarPreferences({ getItem: () => "broken json" }), { open: true, width: 288 });
  assert.deepEqual(readSidebarPreferences({ getItem: () => '{"open":"false","width":"440px"}' }, "sidebar_state=false; xp_sidebar_width=320"), { open: false, width: 320 });
  assert.deepEqual(readSidebarPreferences(undefined, "sidebar_state=maybe; xp_sidebar_width=Infinity", { open: false, width: 352 }), { open: false, width: 352 });
});

test("navigation width stays bounded and leaves room for page content", () => {
  assert.equal(clampSidebarWidth(100), 240);
  assert.equal(clampSidebarWidth(900), 440);
  assert.equal(clampSidebarWidth(Number.NaN), 288);
  assert.equal(clampSidebarWidth(400, 700), 380);
  assert.equal(clampSidebarWidth(440, 375), 240);
  assert.equal(clampSidebarWidth(384.3), 384);
});

test("prepaint restoration uses saved collapse and width on a static document", () => {
  const root = { dataset: {} as Record<string, string>, style: { setProperty: (key: string, value: string) => styles.set(key, value) } };
  const styles = new Map<string, string>();
  runInNewContext(SIDEBAR_PREFERENCES_BOOTSTRAP, {
    document: { documentElement: root, cookie: "sidebar_state=true; xp_sidebar_width=288" },
    innerWidth: 1280,
    localStorage: { getItem: () => '{"open":false,"width":384}' },
  });
  assert.equal(root.dataset.xpSidebarOpen, "false");
  assert.equal(styles.get("--xp-sidebar-preferred-width"), "384px");
});

test("prepaint restoration works when storage throws and rejects invalid widths", () => {
  const dataset: Record<string, string> = {};
  const styles = new Map<string, string>();
  runInNewContext(SIDEBAR_PREFERENCES_BOOTSTRAP, {
    document: { documentElement: { dataset, style: { setProperty: (key: string, value: string) => styles.set(key, value) } }, cookie: "sidebar_state=false; xp_sidebar_width=390" },
    innerWidth: 1280,
    get localStorage() { throw new Error("Disabled"); },
  });
  assert.equal(dataset.xpSidebarOpen, "false");
  assert.equal(styles.get("--xp-sidebar-preferred-width"), "390px");
  runInNewContext(SIDEBAR_PREFERENCES_BOOTSTRAP, {
    document: { documentElement: { dataset, style: { setProperty: (key: string, value: string) => styles.set(key, value) } }, cookie: "xp_sidebar_width=Infinity" },
    innerWidth: 1280,
    localStorage: { getItem: () => '{"width":999999}' },
  });
  assert.equal(styles.get("--xp-sidebar-preferred-width"), "440px");
});
