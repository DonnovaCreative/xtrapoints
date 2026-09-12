// Brand assets and colors edit the school's draft; publication uses the same
// reviewed school revision as the page editor. Session, role, tenant and origin
// checks apply to every mutation, including direct API requests.
export const prerender = false;
import type { APIRoute, APIContext } from "astro";
import { randomUUID } from "node:crypto";
import { writeClient } from "@/config/sanityWrite";
import { resolvePortalPartner } from "@/lib/portalAuth";
import { portalJson as json, requireSameOrigin, isRecord } from "@/lib/portalPermissions";
import {
  EDITABLE_COLORS, EDITABLE_IMAGES, isEditableColor, isEditableImage, isCreditable,
  MAX_CREDIT_LENGTH, HEX, ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES,
} from "@/lib/portalEdit";

type Client = ReturnType<typeof writeClient>;
type Patch = ReturnType<Client["patch"]>;
type BrandAuth = { client: Client; id: string; draftId: string; identity: { userId: string } };
async function authorize(ctx: APIContext, school?: string, partnerId?: string) {
  const resolved = await resolvePortalPartner(ctx, { school, partnerId }, ctx.request.method === "GET" ? "read" : "edit");
  if ("error" in resolved) return resolved;
  try {
    return { client: writeClient().withConfig({ perspective: "raw", useCdn: false }), id: resolved.partner._id, draftId: `drafts.${resolved.partner._id}`, identity: resolved.identity };
  } catch {
    return { error: json({ error: "not_configured", message: "Brand editing isn't available right now." }, 503) };
  }
}
const failed = (error: unknown) => {
  if ((error as { statusCode?: number })?.statusCode === 409) {
    return json({ error: "conflict", message: "The school draft changed. Reload the brand kit before saving again." }, 409);
  }
  console.error("Brand operation failed");
  return json({ error: "write_failed", message: "The request could not be completed. Please try again." }, 502);
};

/** Content, review signal and actor record share one atomic transaction. */
async function commitDraft(auth: BrandAuth, change: (patch: Patch) => Patch, revision: string | undefined, submitted = false) {
  const draft = await auth.client.getDocument(auth.draftId);
  const current = draft ?? await auth.client.getDocument(auth.id);
  if (!current) throw new Error("School content missing");
  if (revision && current._rev !== revision) throw Object.assign(new Error("Revision conflict"), { statusCode: 409 });
  const now = new Date().toISOString();
  const status = submitted ? "in_review" : "draft";
  const signal = { reviewStatus: status, managementUpdatedAt: now, managementUpdatedBy: auth.identity.userId };
  let tx = auth.client.transaction();
  if (!draft) {
    const { _rev, _createdAt, _updatedAt, ...content } = current;
    tx = tx.patch(auth.id, p => p.ifRevisionId(current._rev).set(signal))
      .create({ ...content, _id: auth.draftId });
  } else {
    tx = tx.patch(auth.draftId, p => p.ifRevisionId(current._rev).set(signal));
  }
  tx = tx.patch(auth.draftId, p => {
    let patch = change(p).set({ ...signal, submittedForReview: submitted });
    patch = submitted ? patch.set({ submittedAt: now }) : patch.unset(["submittedAt"]);
    return patch;
  }).patch(auth.id, p => p.set(signal))
    .create({ _id: `schoolAudit.${randomUUID()}`, _type: "schoolAudit", partnerId: auth.id,
      actorId: auth.identity.userId, action: submitted ? "brand_review_requested" : "brand_draft_saved", createdAt: now });
  await tx.commit();
}
const CURRENT = `{
  "revision": _rev,
  "colors": theme{primary, secondary, ink, onAccent},
  "images": {
    "logo": logo.asset->url, "avatar": avatar.asset->url,
    "photos.team": photos.team.asset->url, "photos.celebrate": photos.celebrate.asset->url,
    "photos.fans": photos.fans.asset->url, "photos.action": photos.action.asset->url,
    "photos.mascot": photos.mascot.asset->url, "photos.cutout": photos.cutout.asset->url,
    "photos.cutoutSecondary": photos.cutoutSecondary.asset->url
  },
  "credits": {
    "photos.team": photos.team.credit, "photos.celebrate": photos.celebrate.credit,
    "photos.fans": photos.fans.credit, "photos.action": photos.action.credit, "photos.mascot": photos.mascot.credit
  }, submittedForReview, reviewStatus
}`;
export const GET: APIRoute = async ctx => {
  const auth = await authorize(ctx, ctx.url.searchParams.get("school") ?? undefined, ctx.url.searchParams.get("partnerId") ?? undefined);
  if ("error" in auth) return auth.error;
  try {
    const draft = await auth.client.fetch(`*[_id == $id][0]${CURRENT}`, { id: auth.draftId });
    if (draft) return json({ ...draft, hasDraft: true, pending: true });
    const current = await auth.client.fetch(`*[_id == $id][0]${CURRENT}`, { id: auth.id });
    return json({ ...current, submittedForReview: false, hasDraft: false, pending: false });
  } catch (error) { return failed(error); }
};

export const POST: APIRoute = async ctx => {
  const originError = requireSameOrigin(ctx.request, ctx.url); if (originError) return originError;
  if ((ctx.request.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    let form: FormData;
    try { form = await ctx.request.formData(); } catch { return json({ error: "bad_form" }, 400); }
    const school = form.get("school")?.toString(); const partnerId = form.get("partnerId")?.toString();
    const revision = form.get("revision")?.toString(); const field = form.get("image")?.toString() ?? ""; const file = form.get("file");
    const auth = await authorize(ctx, school, partnerId); if ("error" in auth) return auth.error;
    if (!isEditableImage(field)) return json({ error: "field_not_editable" }, 400);
    if (!(file instanceof File)) return json({ error: "missing_file" }, 400);
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) return json({ error: "bad_type" }, 400);
    if (file.size > MAX_IMAGE_BYTES) return json({ error: "too_large" }, 400);
    try {
      const asset = await auth.client.assets.upload("image", Buffer.from(await file.arrayBuffer()), { filename: file.name, contentType: file.type });
      const path = EDITABLE_IMAGES[field].path;
      await commitDraft(auth, p => {
        if (path.startsWith("photos.")) p = p.setIfMissing({ photos: {} });
        return p.setIfMissing({ [path]: { _type: "image" } }).set({ [`${path}.asset`]: { _type: "reference", _ref: asset._id } });
      }, revision);
      return json({ ok: true, field, url: asset.url });
    } catch (error) { return failed(error); }
  }

  let body: Record<string, unknown>;
  try { const parsed = await ctx.request.json(); if (!isRecord(parsed)) return json({ error: "bad_json" }, 400); body = parsed; }
  catch { return json({ error: "bad_json" }, 400); }
  for (const key of ["school", "partnerId", "revision", "clearImage"]) {
    if (body[key] !== undefined && typeof body[key] !== "string") return json({ error: "bad_json" }, 400);
  }
  if (body.submit !== undefined && typeof body.submit !== "boolean") return json({ error: "bad_json" }, 400);
  const auth = await authorize(ctx, body.school as string | undefined, body.partnerId as string | undefined);
  if ("error" in auth) return auth.error;
  const revision = body.revision as string | undefined;
  try {
    if (body.clearImage) {
      if (!isEditableImage(body.clearImage as string)) return json({ error: "field_not_editable" }, 400);
      const path = EDITABLE_IMAGES[body.clearImage as keyof typeof EDITABLE_IMAGES].path;
      await commitDraft(auth, p => p.unset([path]), revision);
      return json({ ok: true });
    }
    if (body.submit) { await commitDraft(auth, p => p, revision, true); return json({ ok: true, submitted: true }); }
    if (body.credits !== undefined) {
      if (!isRecord(body.credits)) return json({ error: "bad_json" }, 400);
      const set: Record<string, string> = {}; const unset: string[] = [];
      for (const [key, raw] of Object.entries(body.credits)) {
        if (!isCreditable(key)) return json({ error: "field_not_editable", field: key }, 400);
        if (typeof raw !== "string") return json({ error: "bad_credit", field: key }, 400);
        const value = raw.trim(); if (value.length > MAX_CREDIT_LENGTH) return json({ error: "credit_too_long", field: key }, 400);
        if (value) set[`${EDITABLE_IMAGES[key].path}.credit`] = value; else unset.push(`${EDITABLE_IMAGES[key].path}.credit`);
      }
      if (!Object.keys(set).length && !unset.length) return json({ ok: true, noop: true });
      await commitDraft(auth, p => {
        if (Object.keys(set).length) {
          p = p.setIfMissing({ photos: {} });
          for (const path of Object.keys(set)) p = p.setIfMissing({ [path.replace(/\.credit$/, "")]: { _type: "image" } });
          p = p.set(set);
        }
        if (unset.length) p = p.unset(unset); return p;
      }, revision);
      return json({ ok: true });
    }
    if (body.colors !== undefined) {
      if (!isRecord(body.colors)) return json({ error: "bad_json" }, 400);
      const set: Record<string, string> = {}; const unset: string[] = [];
      for (const [key, raw] of Object.entries(body.colors)) {
        if (!isEditableColor(key)) return json({ error: "field_not_editable", field: key }, 400);
        if (typeof raw !== "string") return json({ error: "bad_color", field: key }, 400);
        const value = raw.trim();
        if (!value) unset.push(`theme.${key}`);
        else if (!HEX.test(value)) return json({ error: "bad_color", field: key, message: "Colors must use a #rrggbb value." }, 400);
        else set[`theme.${key}`] = value.toLowerCase();
      }
      if (!Object.keys(set).length && !unset.length) return json({ ok: true, noop: true });
      await commitDraft(auth, p => { p = p.setIfMissing({ theme: {} }); if (Object.keys(set).length) p = p.set(set); if (unset.length) p = p.unset(unset); return p; }, revision);
      return json({ ok: true, colors: Object.keys(EDITABLE_COLORS) });
    }
    return json({ error: "nothing_to_do" }, 400);
  } catch (error) { return failed(error); }
};
