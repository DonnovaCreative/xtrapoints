// Reads a school's tweaks to a generated template.
//
// Written by the portal (src/pages/api/portal-template.ts), consumed by the
// template's renderer. Both sides agree on src/lib/templateFields.ts, and this
// module drops anything not declared there — so a field removed from the spec
// stops applying immediately rather than lingering in old documents.
//
// Empty values are dropped too, which is what makes "clear it to get the default
// back" work: the renderer only ever sees overrides that are actually set.
import { sanityClient } from "@/config/sanity";
import {
  EMPTY_OVERRIDES,
  getTemplateField,
  type TemplateOverrides,
} from "@/lib/templateFields";

/** Deterministic id, so a write is an upsert and reads need no query. */
export const overrideId = (schoolSlug: string, templateId: string) =>
  `tplov-${schoolSlug}-${templateId}`;

interface OverrideDoc {
  fields?: { key?: string; value?: string }[] | null;
  lists?: { key?: string; items?: string[] | null }[] | null;
  images?: { key?: string; url?: string | null }[] | null;
  updatedAt?: string | null;
}

const PROJECTION = `{
  fields[]{ key, value },
  lists[]{ key, items },
  "images": images[]{ key, "url": asset.asset->url },
  updatedAt
}`;

/** Shape the doc into what renderers use, filtered to the current spec. */
export const shapeOverrides = (
  templateId: string,
  doc: OverrideDoc | null | undefined,
): TemplateOverrides => {
  if (!doc) return EMPTY_OVERRIDES;

  const values: Record<string, string> = {};
  for (const f of doc.fields ?? []) {
    const value = f?.value?.trim();
    if (!f?.key || !value) continue;
    if (!getTemplateField(templateId, f.key)) continue;
    values[f.key] = value;
  }

  const lists: Record<string, string[]> = {};
  for (const l of doc.lists ?? []) {
    if (!l?.key || !getTemplateField(templateId, l.key)) continue;
    const items = (l.items ?? []).map((i) => i?.trim()).filter((i): i is string => Boolean(i));
    if (items.length) lists[l.key] = items;
  }

  const images: Record<string, string> = {};
  for (const i of doc.images ?? []) {
    if (!i?.key || !i.url || !getTemplateField(templateId, i.key)) continue;
    images[i.key] = i.url;
  }

  return { values, lists, images };
};

/**
 * A school's overrides for one template. Returns empties on any failure — a
 * template must still render if this read fails, since the whole point is that
 * the defaults stand on their own.
 */
export async function getTemplateOverrides(
  schoolSlug: string,
  templateId: string,
): Promise<TemplateOverrides> {
  try {
    const doc = await sanityClient.fetch<OverrideDoc | null>(
      `*[_id == $id][0]${PROJECTION}`,
      { id: overrideId(schoolSlug, templateId) },
    );
    return shapeOverrides(templateId, doc);
  } catch (err) {
    console.error(`template overrides read failed (${schoolSlug}/${templateId}):`, err);
    return EMPTY_OVERRIDES;
  }
}

/** When this school last changed this template — the export's cache key. */
export async function getOverrideVersion(
  schoolSlug: string,
  templateId: string,
): Promise<string | undefined> {
  try {
    const at = await sanityClient.fetch<string | null>(`*[_id == $id][0].updatedAt`, {
      id: overrideId(schoolSlug, templateId),
    });
    return at ?? undefined;
  } catch {
    return undefined;
  }
}
