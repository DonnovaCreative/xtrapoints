// Shared helpers for the content scripts (import.ts, seed-college.ts).
// Run via `sanity exec <script> --with-user-token`, so writes use the operator's
// own Sanity login — no separate write token to manage.
//
// sanity/cli is CommonJS; under Node's type-stripping ESM loader a named import
// fails, so load getCliClient through createRequire (see the seed history).
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getCliClient } = require("sanity/cli");

export type SanityClient = {
  assets: {
    upload: (
      type: "image",
      body: Buffer,
      opts: { filename: string; contentType: string },
    ) => Promise<{ _id: string }>;
  };
  createOrReplace: (doc: Record<string, unknown>) => Promise<{ _id: string }>;
  delete: (id: string) => Promise<unknown>;
  fetch: <T>(query: string, params?: Record<string, unknown>) => Promise<T>;
};

export const getClient = (): SanityClient =>
  getCliClient({ apiVersion: "2025-01-01" });

/** "Sam Houston State" → "sam-houston-state". */
export const slugify = (s: string): string =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** A Sanity color-input value from a hex string (accepts with/without leading #). */
export const color = (hex?: string) => {
  if (!hex) return undefined;
  const h = (hex.startsWith("#") ? hex : `#${hex}`).toLowerCase();
  return { _type: "color", hex: h };
};

const contentTypeFor = (name: string): string => {
  const n = name.toLowerCase();
  return n.endsWith(".svg")
    ? "image/svg+xml"
    : n.endsWith(".png")
      ? "image/png"
      : n.endsWith(".webp")
        ? "image/webp"
        : n.endsWith(".gif")
          ? "image/gif"
          : "image/jpeg";
};

/** Upload an image from a local file path OR a remote URL; returns an image field value. */
export async function uploadImage(client: SanityClient, ref: string) {
  const isRemote = /^https?:\/\//.test(ref);
  let buf: Buffer;
  let filename: string;
  if (isRemote) {
    const res = await fetch(ref);
    if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${ref}`);
    buf = Buffer.from(await res.arrayBuffer());
    filename = path.basename(new URL(ref).pathname) || "image";
  } else {
    buf = await readFile(path.resolve(ref));
    filename = path.basename(ref);
  }
  const asset = await client.assets.upload("image", buf, {
    filename,
    contentType: contentTypeFor(filename),
  });
  return { _type: "image", asset: { _type: "reference", _ref: asset._id } };
}

/**
 * Create/replace a school document. publish=false writes a DRAFT
 * (`drafts.school.<slug>`) that only appears once an editor publishes it in the
 * Studio; publish=true writes it live.
 */
export async function writeSchool(
  client: SanityClient,
  slug: string,
  body: Record<string, unknown>,
  publish: boolean,
) {
  const _id = `${publish ? "" : "drafts."}school.${slug}`;
  return client.createOrReplace({ _id, _type: "school", ...body });
}
