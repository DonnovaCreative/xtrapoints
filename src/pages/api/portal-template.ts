// The portal's template customisation write path.
//
//   GET  ?school=<slug>&template=<id>            → current values
//   POST { school, template, values: {...} }     → set text / url / color fields
//   POST { school, template, lists: {...} }      → set list fields
//   POST { school, template, image: <key> } + multipart file → replace an image
//   POST { school, template, clear: <key> }      → back to the derived default
//   POST { school, template, reset: true }       → clear everything
//
// Unlike portal-brand.ts these writes are PUBLISHED IMMEDIATELY rather than
// staged on a draft. Brand edits change a school's public pages, so they go
// through XtraPoint review; this changes a PDF the school prints themselves, and
// "tweak, look, export" doesn't work if every tweak waits on us. Nothing here
// can reach their pages — the allowlist below is only ever template fields.
//
// AUTHORIZATION is by Clerk session, same as the brand editor: the caller must
// belong to the organization mapped to this school, or be XtraPoint staff. The
// fields they may touch come from src/lib/templateFields.ts, so a template's
// non-editable copy is unreachable even by a crafted request.
export const prerender = false;

import type { APIRoute, APIContext } from "astro";
import { writeClient } from "@/config/sanityWrite";
import { getPortalIdentity } from "@/lib/portalAuth";
import { overrideId, shapeOverrides } from "@/data/templateOverrides";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  getTemplateField,
  getTemplateSpec,
} from "@/lib/templateFields";
import { HEX } from "@/lib/portalEdit";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

async function authorize(ctx: APIContext, slug?: string, templateId?: string) {
  if (!slug) return { error: json({ error: "missing_school" }, 400) };
  const spec = getTemplateSpec(templateId);
  if (!spec) return { error: json({ error: "no_such_template" }, 404) };

  const identity = await getPortalIdentity(ctx);
  if (!identity) return { error: json({ error: "unauthorized" }, 401) };
  if (!identity.isStaff && identity.schoolSlug !== slug) {
    return { error: json({ error: "forbidden" }, 403) };
  }

  let client: ReturnType<typeof writeClient>;
  try {
    client = writeClient();
  } catch {
    console.error("portal-template: SANITY_WRITE_TOKEN is not configured");
    return {
      error: json(
        {
          error: "not_configured",
          message: "Customising isn't available right now. We've been told about it.",
        },
        503,
      ),
    };
  }

  return { client, spec, id: overrideId(slug, spec.id), slug };
}

const PROJECTION = `{
  fields[]{ key, value },
  lists[]{ key, items },
  "images": images[]{ key, "url": asset.asset->url },
  updatedAt
}`;

/** The override document, created empty on first write. */
async function ensureDoc(
  client: ReturnType<typeof writeClient>,
  id: string,
  slug: string,
  templateId: string,
) {
  await client.createIfNotExists({
    _id: id,
    _type: "templateOverride",
    schoolSlug: slug,
    templateId,
    fields: [],
    lists: [],
    images: [],
  });
}

const touch = (client: ReturnType<typeof writeClient>, id: string) =>
  client.patch(id).set({ updatedAt: new Date().toISOString() }).commit();

/**
 * Upsert one entry in a keyed array. Sanity has no "set by key" primitive, so
 * this drops any existing entry for the key and appends the new one — which also
 * self-heals a document that somehow ended up with duplicates.
 */
async function upsertByKey(
  client: ReturnType<typeof writeClient>,
  id: string,
  arrayName: "fields" | "lists" | "images",
  key: string,
  entry: Record<string, unknown> | null,
) {
  await client
    .patch(id)
    .setIfMissing({ [arrayName]: [] })
    .unset([`${arrayName}[key == "${key}"]`])
    .commit();
  if (entry) {
    await client
      .patch(id)
      .append(arrayName, [{ _key: `${key}-${Date.now().toString(36)}`, key, ...entry }])
      .commit();
  }
}

export const GET: APIRoute = async (ctx) => {
  const slug = ctx.url.searchParams.get("school") ?? undefined;
  const templateId = ctx.url.searchParams.get("template") ?? undefined;
  const auth = await authorize(ctx, slug, templateId);
  if ("error" in auth) return auth.error;

  try {
    const doc = await auth.client.fetch(`*[_id == $id][0]${PROJECTION}`, { id: auth.id });
    return json({
      ...shapeOverrides(auth.spec.id, doc),
      updatedAt: doc?.updatedAt ?? null,
    });
  } catch (err) {
    console.error("portal-template GET failed:", err);
    return json({ error: "read_failed", message: (err as Error).message }, 502);
  }
};

export const POST: APIRoute = async (ctx) => {
  const contentType = ctx.request.headers.get("content-type") ?? "";

  // ── Image upload (multipart) ───────────────────────────────────────────────
  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await ctx.request.formData();
    } catch {
      return json({ error: "bad_form" }, 400);
    }

    const slug = form.get("school")?.toString();
    const templateId = form.get("template")?.toString();
    const key = form.get("image")?.toString() ?? "";
    const file = form.get("file");

    const auth = await authorize(ctx, slug, templateId);
    if ("error" in auth) return auth.error;

    const field = getTemplateField(auth.spec.id, key);
    if (!field || field.control !== "image") return json({ error: "field_not_editable" }, 400);
    if (!(file instanceof File)) return json({ error: "missing_file" }, 400);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return json({ error: "bad_type", message: `${file.type || "unknown"} isn't accepted` }, 400);
    }
    if (file.size > MAX_IMAGE_BYTES) return json({ error: "too_large" }, 400);

    try {
      await ensureDoc(auth.client, auth.id, auth.slug, auth.spec.id);
      const buffer = Buffer.from(await file.arrayBuffer());
      const asset = await auth.client.assets.upload("image", buffer, {
        filename: file.name,
        contentType: file.type,
      });
      await upsertByKey(auth.client, auth.id, "images", key, {
        asset: { _type: "image", asset: { _type: "reference", _ref: asset._id } },
      });
      await touch(auth.client, auth.id);
      return json({ ok: true, key, url: asset.url });
    } catch (err) {
      console.error("portal-template upload failed:", err);
      return json({ error: "upload_failed", message: (err as Error).message }, 502);
    }
  }

  // ── JSON actions ───────────────────────────────────────────────────────────
  let body: {
    school?: string;
    template?: string;
    values?: Record<string, unknown>;
    lists?: Record<string, unknown>;
    clear?: string;
    reset?: boolean;
  };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const auth = await authorize(ctx, body.school, body.template);
  if ("error" in auth) return auth.error;

  try {
    if (body.reset) {
      await auth.client.delete(auth.id);
      return json({ ok: true, reset: true });
    }

    if (body.clear) {
      const field = getTemplateField(auth.spec.id, body.clear);
      if (!field) return json({ error: "field_not_editable" }, 400);
      const arrayName =
        field.control === "image" ? "images" : field.control === "list" ? "lists" : "fields";
      await upsertByKey(auth.client, auth.id, arrayName, body.clear, null);
      await touch(auth.client, auth.id);
      return json({ ok: true });
    }

    // Validate everything BEFORE writing, so a bad field can't leave the sheet
    // half-updated.
    const scalars: { key: string; value: string }[] = [];
    for (const [key, raw] of Object.entries(body.values ?? {})) {
      const field = getTemplateField(auth.spec.id, key);
      if (!field || field.control === "image" || field.control === "list") {
        return json({ error: "field_not_editable", field: key }, 400);
      }
      const value = typeof raw === "string" ? raw.trim() : "";
      if (!value) {
        scalars.push({ key, value: "" }); // empty → cleared below
        continue;
      }
      if (field.maxLength && value.length > field.maxLength) {
        return json(
          { error: "too_long", field: key, message: `${field.label} is limited to ${field.maxLength} characters.` },
          400,
        );
      }
      if (field.control === "color" && !HEX.test(value)) {
        return json({ error: "bad_color", field: key, message: `${field.label} must be a #rrggbb value.` }, 400);
      }
      if (field.control === "url" && !/^https?:\/\/\S+$/i.test(value)) {
        return json({ error: "bad_url", field: key, message: `${field.label} must start with http:// or https://.` }, 400);
      }
      scalars.push({ key, value });
    }

    const listWrites: { key: string; items: string[] }[] = [];
    for (const [key, raw] of Object.entries(body.lists ?? {})) {
      const field = getTemplateField(auth.spec.id, key);
      if (!field || field.control !== "list") {
        return json({ error: "field_not_editable", field: key }, 400);
      }
      if (!Array.isArray(raw)) return json({ error: "bad_list", field: key }, 400);
      const items = raw
        .map((i) => (typeof i === "string" ? i.trim() : ""))
        .filter(Boolean) as string[];
      if (field.maxItems && items.length > field.maxItems) {
        return json(
          { error: "too_many", field: key, message: `${field.label} takes at most ${field.maxItems} items.` },
          400,
        );
      }
      const tooLong = field.itemMaxLength && items.find((i) => i.length > field.itemMaxLength!);
      if (tooLong) {
        return json(
          { error: "item_too_long", field: key, message: `Each item in ${field.label} is limited to ${field.itemMaxLength} characters.` },
          400,
        );
      }
      listWrites.push({ key, items });
    }

    if (!scalars.length && !listWrites.length) return json({ ok: true, noop: true });

    await ensureDoc(auth.client, auth.id, auth.slug, auth.spec.id);
    for (const { key, value } of scalars) {
      await upsertByKey(auth.client, auth.id, "fields", key, value ? { value } : null);
    }
    for (const { key, items } of listWrites) {
      await upsertByKey(auth.client, auth.id, "lists", key, items.length ? { items } : null);
    }
    const updatedAt = new Date().toISOString();
    await auth.client.patch(auth.id).set({ updatedAt }).commit();
    return json({ ok: true, updatedAt });
  } catch (err) {
    console.error("portal-template POST failed:", err);
    return json({ error: "write_failed", message: (err as Error).message }, 502);
  }
};
