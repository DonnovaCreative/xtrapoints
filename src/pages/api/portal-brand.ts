// The portal's brand editor write path.
//
// Everything a school changes lands on the Sanity DRAFT of their own school
// document — never the published one. That's the whole review model: their edits
// show up in the Studio as unpublished changes, XtraPoint reviews them there,
// publishes to staging, and approves to production. No parallel submission
// system, and the existing draft-preview route already renders exactly what
// they'll get.
//
//   GET  ?school=<slug>                  → current draft values
//   POST { school, colors: {...} }       → set brand colors
//   POST { school, image: <field> } + multipart file → replace an image
//   POST { school, clearImage: <field> } → remove an image
//   POST { school, credits: {...} }      → set photo credits
//   POST { school, submit: true }        → tell XtraPoint it's ready
//
// AUTHORIZATION is by Clerk session, not a shared secret: the caller must be a
// member of the organization mapped to this school (or XtraPoint staff). The
// fields they may touch are allowlisted in src/lib/portalEdit.ts — a school
// cannot reach productionStatus, portalEnabled, portalToken or their slug, so
// they can't publish themselves live or change their own access.
export const prerender = false;

import type { APIRoute, APIContext } from "astro";
import { writeClient } from "@/config/sanityWrite";
import { getPortalIdentity } from "@/lib/portalAuth";
import {
  EDITABLE_COLORS,
  EDITABLE_IMAGES,
  isEditableColor,
  isEditableImage,
  isCreditable,
  MAX_CREDIT_LENGTH,
  HEX,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  type EditableImage,
} from "@/lib/portalEdit";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });

/** Confirms the caller may edit this school, and returns its document id. */
async function authorize(ctx: APIContext, slug: string | undefined) {
  if (!slug) return { error: json({ error: "missing_school" }, 400) };

  const identity = await getPortalIdentity(ctx);
  if (!identity) return { error: json({ error: "unauthorized" }, 401) };
  if (!identity.isStaff && identity.schoolSlug !== slug) {
    return { error: json({ error: "forbidden" }, 403) };
  }

  let client: ReturnType<typeof writeClient>;
  try {
    client = writeClient();
  } catch {
    // Missing SANITY_WRITE_TOKEN. Say so plainly rather than throwing a 500 that
    // looks like the school's fault.
    console.error("portal-brand: SANITY_WRITE_TOKEN is not configured");
    return {
      error: json(
        {
          error: "not_configured",
          message: "Editing isn't available right now. We've been told about it.",
        },
        503,
      ),
    };
  }

  const id = await client.fetch<string | null>(
    `*[_type == "school" && !(_id in path("drafts.**")) && slug.current == $slug][0]._id`,
    { slug },
  );
  if (!id) return { error: json({ error: "no_such_school" }, 404) };
  return { client, id, draftId: `drafts.${id}` };
}

/**
 * Edits go to the draft, so make sure one exists first — copied from the
 * published document, exactly as the Studio does when you start typing.
 */
async function ensureDraft(client: ReturnType<typeof writeClient>, id: string, draftId: string) {
  const existing = await client.getDocument(draftId);
  if (existing) return;
  const published = await client.getDocument(id);
  if (!published) throw new Error("published document missing");
  await client.createIfNotExists({ ...published, _id: draftId });
}

/** Draft values if a draft exists, else the published ones. */
const CURRENT = `{
  "colors": theme{primary, secondary, ink, onAccent},
  "images": {
    "logo": logo.asset->url,
    "avatar": avatar.asset->url,
    "photos.team": photos.team.asset->url,
    "photos.celebrate": photos.celebrate.asset->url,
    "photos.fans": photos.fans.asset->url,
    "photos.action": photos.action.asset->url,
    "photos.mascot": photos.mascot.asset->url
  },
  "credits": {
    "photos.team": photos.team.credit,
    "photos.celebrate": photos.celebrate.credit,
    "photos.fans": photos.fans.credit,
    "photos.action": photos.action.credit,
    "photos.mascot": photos.mascot.credit
  },
  submittedForReview,
  "hasDraft": true
}`;

export const GET: APIRoute = async (ctx) => {
  const slug = ctx.url.searchParams.get("school") ?? undefined;
  const auth = await authorize(ctx, slug);
  if ("error" in auth) return auth.error;

  try {
    const draft = await auth.client.fetch(`*[_id == $id][0]${CURRENT}`, { id: auth.draftId });
    if (draft) return json({ ...draft, pending: true });
    const published = await auth.client.fetch(`*[_id == $id][0]${CURRENT}`, { id: auth.id });
    return json({ ...published, hasDraft: false, pending: false });
  } catch (err) {
    console.error("portal-brand GET failed:", err);
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
    const field = form.get("image")?.toString() ?? "";
    const file = form.get("file");

    const auth = await authorize(ctx, slug);
    if ("error" in auth) return auth.error;

    if (!isEditableImage(field)) return json({ error: "field_not_editable" }, 400);
    if (!(file instanceof File)) return json({ error: "missing_file" }, 400);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
      return json({ error: "bad_type", message: `${file.type || "unknown"} isn't accepted` }, 400);
    }
    if (file.size > MAX_IMAGE_BYTES) return json({ error: "too_large" }, 400);

    try {
      await ensureDraft(auth.client, auth.id, auth.draftId);
      const buffer = Buffer.from(await file.arrayBuffer());
      const asset = await auth.client.assets.upload("image", buffer, {
        filename: file.name,
        contentType: file.type,
      });
      // Set the asset reference only — replacing the whole image object would
      // wipe the photo credit sitting alongside it.
      const path = EDITABLE_IMAGES[field as EditableImage].path;
      await auth.client
        .patch(auth.draftId)
        .setIfMissing({ [path]: { _type: "image" } })
        .set({ [`${path}.asset`]: { _type: "reference", _ref: asset._id } })
        .commit();
      return json({ ok: true, field, url: asset.url });
    } catch (err) {
      console.error("portal-brand upload failed:", err);
      return json({ error: "upload_failed", message: (err as Error).message }, 502);
    }
  }

  // ── JSON actions ───────────────────────────────────────────────────────────
  let body: {
    school?: string;
    colors?: Record<string, unknown>;
    clearImage?: string;
    credits?: Record<string, unknown>;
    submit?: boolean;
  };
  try {
    body = await ctx.request.json();
  } catch {
    return json({ error: "bad_json" }, 400);
  }

  const auth = await authorize(ctx, body.school);
  if ("error" in auth) return auth.error;

  try {
    // Validate BEFORE creating a draft. A request that changes nothing shouldn't
    // manufacture one — the Studio would then show "unpublished changes" for a
    // school that never actually edited anything.
    if (
      (body.colors && Object.keys(body.colors).length === 0) ||
      (body.credits && Object.keys(body.credits).length === 0)
    ) {
      return json({ ok: true, noop: true });
    }

    await ensureDraft(auth.client, auth.id, auth.draftId);

    if (body.clearImage) {
      if (!isEditableImage(body.clearImage)) return json({ error: "field_not_editable" }, 400);
      await auth.client
        .patch(auth.draftId)
        .unset([EDITABLE_IMAGES[body.clearImage as EditableImage].path])
        .commit();
      return json({ ok: true });
    }

    if (body.submit) {
      await auth.client
        .patch(auth.draftId)
        .set({ submittedForReview: true, submittedAt: new Date().toISOString() })
        .commit();
      return json({ ok: true, submitted: true });
    }

    if (body.credits) {
      const set: Record<string, string> = {};
      const unset: string[] = [];
      for (const [key, raw] of Object.entries(body.credits)) {
        // Only photos take a credit — a logo doesn't, and allowing it would put
        // a caption somewhere nothing renders it.
        if (!isCreditable(key)) return json({ error: "field_not_editable", field: key }, 400);
        const value = typeof raw === "string" ? raw.trim() : "";
        if (!value) {
          unset.push(`${EDITABLE_IMAGES[key].path}.credit`);
          continue;
        }
        if (value.length > MAX_CREDIT_LENGTH) {
          return json({ error: "credit_too_long", field: key }, 400);
        }
        set[`${EDITABLE_IMAGES[key].path}.credit`] = value;
      }
      let patch = auth.client.patch(auth.draftId);
      if (Object.keys(set).length) patch = patch.set(set);
      if (unset.length) patch = patch.unset(unset);
      await patch.commit();
      return json({ ok: true });
    }

    if (body.colors) {
      const set: Record<string, string> = {};
      const unset: string[] = [];
      for (const [key, raw] of Object.entries(body.colors)) {
        if (!isEditableColor(key)) return json({ error: "field_not_editable", field: key }, 400);
        const value = typeof raw === "string" ? raw.trim() : "";
        if (!value) {
          unset.push(`theme.${key}`);
          continue;
        }
        if (!HEX.test(value)) {
          return json({ error: "bad_color", field: key, message: `${key} must be a #rrggbb value` }, 400);
        }
        set[`theme.${key}`] = value.toLowerCase();
      }
      let patch = auth.client.patch(auth.draftId);
      // theme is an object field; make sure it exists before setting into it.
      patch = patch.setIfMissing({ theme: {} });
      if (Object.keys(set).length) patch = patch.set(set);
      if (unset.length) patch = patch.unset(unset);
      await patch.commit();
      return json({ ok: true, colors: Object.keys(EDITABLE_COLORS) });
    }

    return json({ error: "nothing_to_do" }, 400);
  } catch (err) {
    console.error("portal-brand POST failed:", err);
    return json({ error: "write_failed", message: (err as Error).message }, 502);
  }
};
