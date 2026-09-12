/** Application-owned school lifecycle. Sanity is a persistence adapter, not the admin UI. */
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { sanityClient } from "@/config/sanity";
import { writeClient } from "@/config/sanityWrite";
import { SCHOOL_PROJECTION_FIELDS } from "@/data/schoolsSource";
import {
  canonicalPartnerId,
  schoolSlug,
  validateSchoolChanges,
  safeEditorFields,
  schoolContent,
  SchoolInputError,
  requireRevision,
} from "@/lib/schoolManagement";

type Raw = Record<string, any> & { _id: string; _rev: string; _type: string };
const client = () => sanityClient.withConfig({ perspective: "raw", useCdn: false });
export async function schoolPair(partnerId: string) {
  canonicalPartnerId(partnerId);
  const result = await client().fetch<{
    live: Raw | null;
    draft: Raw | null;
    liveProjection: any;
    draftProjection: any;
  }>(
    `{
    "live": *[_id==$id && _type=="school"][0],
    "draft": *[_id==$draftId && _type=="school"][0],
    "liveProjection": *[_id==$id && _type=="school"][0]{${SCHOOL_PROJECTION_FIELDS}},
    "draftProjection": *[_id==$draftId && _type=="school"][0]{${SCHOOL_PROJECTION_FIELDS}}
  }`,
    { id: partnerId, draftId: `drafts.${partnerId}` },
  );
  if (!result.live && !result.draft) throw new SchoolInputError("School not found.", 404);
  return result;
}
export async function listManagedSchools(search = "", after = "", limit = 30) {
  // Cursor pagination has bounded work per request and includes legacy draft-only schools.
  const rows = await client().fetch<any[]>(
    `*[_type=="school" && !(_id in path("versions.**")) && _id > $after && ($q=="" || name match $q || short match $q || slug.current match $q)] | order(_id asc)[0...$limit]{_id,_rev,name,short,"slug":slug.current,productionStatus,portalEnabled,managementVersion,reviewStatus,"logo":avatar.asset->url,"primary":theme.primary}`,
    {
      q: search ? `*${search.replace(/[\[\]*?]/g, "").slice(0, 100)}*` : "",
      after,
      limit: limit + 1,
    },
  );
  const page = rows.slice(0, limit);
  return { schools: page, next: rows.length > limit ? page.at(-1)?._id : null };
}
export async function schoolEditor(partnerId: string) {
  const { live, draft } = await schoolPair(partnerId);
  const current = draft ?? live!;
  const history = await client().fetch<any[]>(
    `*[_type=="schoolRelease" && partnerId==$id] | order(createdAt desc)[0...20]{_id,createdAt,actorId,note}`,
    { id: partnerId },
  );
  return {
    partnerId,
    revision: current._rev,
    publishedRevision: live?._rev ?? null,
    slug: current.slug?.current ?? "",
    fields: safeEditorFields(current),
    hasDraft: Boolean(draft),
    published: live?.productionStatus === "live",
    livePages: live?.livePages ?? { donor: true, ambassador: true },
    portalEnabled: live?.portalEnabled === true,
    reviewStatus: live?.reviewStatus ?? "draft",
    previewExpiresAt: live?.salesPreviewExpiresAt ?? null,
    history,
  };
}
function audit(partnerId: string, actorId: string, action: string, detail?: unknown) {
  return {
    _id: `schoolAudit.${randomUUID()}`,
    _type: "schoolAudit",
    partnerId,
    actorId,
    action,
    createdAt: new Date().toISOString(),
    ...(detail ? { detail } : {}),
  };
}
export async function createManagedSchool(input: Record<string, unknown>, actorId: string) {
  const slug = schoolSlug(input.slug);
  const fields = validateSchoolChanges(input.fields);
  for (const key of ["name", "short", "mascot", "fund"])
    if (!fields[key])
      throw new SchoolInputError("School name, short name, mascot and fund are required.");
  const existing = await client().fetch<string | null>(
    `*[_type=="school" && slug.current==$slug][0]._id`,
    { slug },
  );
  if (existing) throw new SchoolInputError("A school already uses that page address.", 409);
  const id = `school.${randomUUID()}`;
  const doc: Record<string, unknown> = {
    _id: id,
    _type: "school",
    slug: { _type: "slug", current: slug },
    productionStatus: "draft",
    portalEnabled: false,
    managementVersion: 2,
    reviewStatus: "draft",
    tiersToBeAnnounced: true,
    theme: { primary: "#aaf10a", ink: "#03116d" },
  };
  for (const [key, v] of Object.entries(fields)) {
    if (key.startsWith("theme.")) (doc.theme as Record<string, unknown>)[key.slice(6)] = v;
    else doc[key] = v;
  }
  // Unique claim makes simultaneous creation race-safe. Existing legacy slugs were checked above.
  await writeClient()
    .transaction()
    .create({ _id: `schoolSlug.${slug}`, _type: "schoolSlug", partnerId: id, slug })
    .create(doc as any)
    .create(audit(id, actorId, "created"))
    .commit();
  return schoolEditor(id);
}
export async function saveSchool(
  partnerId: string,
  revision: string,
  changes: unknown,
  actorId: string,
) {
  requireRevision(revision);
  const { live, draft } = await schoolPair(partnerId);
  const current = draft ?? live!;
  if (current._rev !== revision)
    throw new SchoolInputError("Someone changed this school. Reload before saving.", 409);
  const values = validateSchoolChanges(changes);
  const w = writeClient();
  let tx = w.transaction();
  // An editor can change known fields without dropping retained metadata on
  // the same keyed tier/program entry. Removed entries are intentional edits.
  for (const key of ["ambassadorTiers", "ambassadorPrograms"])
    if (Array.isArray(values[key])) {
      values[key] = (values[key] as Record<string, unknown>[]).map((entry) => ({
        ...(current[key] ?? []).find((old: any) => old._key === entry._key),
        ...entry,
      }));
    }
  if (!draft) {
    const { _rev, _createdAt, _updatedAt, ...copy } = live!;
    tx = tx
      .patch(live!._id, (p) => p.ifRevisionId(live!._rev).set({ reviewStatus: "draft" }))
      .create({ ...copy, _id: `drafts.${partnerId}` } as any);
  } else
    tx = tx.patch(draft._id, (p) =>
      p.ifRevisionId(revision).set({ managementUpdatedAt: new Date().toISOString() }),
    );
  tx = tx.patch(`drafts.${partnerId}`, (p) =>
    p.set({
      ...values,
      managementUpdatedAt: new Date().toISOString(),
      managementUpdatedBy: actorId,
    }),
  );
  if (live) tx = tx.patch(live._id, (p) => p.set({ reviewStatus: "draft" }));
  await tx
    .create(audit(partnerId, actorId, "draft_saved", { fields: Object.keys(values) }))
    .commit();
  return schoolEditor(partnerId);
}
export async function setSchoolReview(partnerId: string, revision: string, actorId: string) {
  const pair = await schoolPair(partnerId);
  const current = pair.draft ?? pair.live!;
  requireRevision(revision);
  if (current._rev !== revision)
    throw new SchoolInputError("The draft changed. Reload and review it again.", 409);
  let tx = writeClient()
    .transaction()
    .patch(current._id, (p) =>
      p.ifRevisionId(revision).set({ managementUpdatedAt: new Date().toISOString() }),
    );
  if (!pair.live)
    throw new SchoolInputError(
      "Ask XtraPoint to finish importing this school before requesting publication.",
      409,
    );
  await tx
    .patch(partnerId, (p) => p.set({ reviewStatus: "in_review" }))
    .create(audit(partnerId, actorId, "review_requested"))
    .commit();
  return schoolEditor(partnerId);
}
export async function publishSchool(
  partnerId: string,
  revision: string,
  publishedRevision: string | null,
  pages: { donor: boolean; ambassador: boolean },
  actorId: string,
) {
  requireRevision(revision);
  const { live, draft, liveProjection, draftProjection } = await schoolPair(partnerId);
  const current = draft ?? live!;
  if (current._rev !== revision || (live?._rev ?? null) !== publishedRevision)
    throw new SchoolInputError(
      "This school changed. Review the latest preview before publishing.",
      409,
    );
  const projection = draft ? draftProjection : liveProjection;
  if (
    !projection?.slug ||
    !projection.name ||
    !projection.short ||
    !projection.mascot ||
    !projection.fund
  )
    throw new SchoolInputError("Complete the required school fields before publishing.");
  const duplicate = await client().fetch<string | null>(
    `*[_type=="school" && slug.current==$slug && !(_id in [$id,$draftId])][0]._id`,
    { slug: projection.slug, id: partnerId, draftId: `drafts.${partnerId}` },
  );
  if (duplicate)
    throw new SchoolInputError(
      "Another school record uses this page address. Resolve the duplicate before publication; both records remain preserved.",
      409,
    );
  const releaseId = `schoolRelease.${randomUUID()}`;
  const now = new Date().toISOString();
  const w = writeClient();
  let tx = w.transaction();
  if (live) {
    const removable = [
      "logo",
      "avatar",
      "photos",
      "theme",
      "logoBadge",
      "whiteHeader",
      "logoLockup",
      "headerHug",
      "headerPadding",
      "logoSize",
      "logoHeight",
      "headerHeightPx",
      "tiersToBeAnnounced",
      "ambassadorTiers",
      "ambassadorPrograms",
      "name",
      "short",
      "mascot",
      "fund",
      "city",
      "state",
      "fundShort",
      "beneficiary",
      "whyGiveHeading",
      "whyGiveBody",
      "videoUrl",
      "videoHeading",
      "videoCaption",
    ];
    const removed = removable.filter(
      (key) => Object.hasOwn(live, key) && !Object.hasOwn(current, key),
    );
    tx = tx.patch(partnerId, (p) => {
      let patch = p
        .ifRevisionId(live._rev)
        .set({
          ...schoolContent(current),
          approvedVersion: JSON.stringify(projection),
          productionStatus: "live",
          livePages: pages,
          approvedAt: now,
          approvedBy: actorId,
          reviewStatus: "published",
          managementVersion: 2,
          publishedReleaseId: releaseId,
        });
      return removed.length ? patch.unset(removed) : patch;
    });
  } else {
    const { _rev, _createdAt, _updatedAt, ...copy } = current;
    tx = tx.create({
      ...copy,
      _id: partnerId,
      approvedVersion: JSON.stringify(projection),
      productionStatus: "live",
      livePages: pages,
      approvedAt: now,
      approvedBy: actorId,
      reviewStatus: "published",
      managementVersion: 2,
      publishedReleaseId: releaseId,
    } as any);
  }
  if (draft)
    tx = tx
      .patch(draft._id, (p) => p.ifRevisionId(draft._rev).set({ managementUpdatedAt: now }))
      .delete(draft._id);
  // Capture a legacy approved snapshot before its first application publication.
  if (live?.approvedVersion && !live.publishedReleaseId)
    tx = tx.create({
      _id: `schoolRelease.${randomUUID()}`,
      _type: "schoolRelease",
      partnerId,
      createdAt: live.approvedAt ?? now,
      actorId,
      note: "Preserved previous approved version",
      approvedVersion: live.approvedVersion,
      livePages: live.livePages ?? { donor: true, ambassador: true },
    });
  await tx
    .create({
      _id: releaseId,
      _type: "schoolRelease",
      partnerId,
      createdAt: now,
      actorId,
      note: "Published from reviewed draft",
      approvedVersion: JSON.stringify(projection),
      livePages: pages,
    })
    .create(audit(partnerId, actorId, "published", { releaseId }))
    .commit();
  return schoolEditor(partnerId);
}
export async function restoreSchoolRelease(
  partnerId: string,
  revision: string,
  releaseId: string,
  actorId: string,
) {
  requireRevision(revision);
  const release = await client().fetch<any>(
    `*[_type=="schoolRelease" && _id==$releaseId && partnerId==$partnerId][0]`,
    { releaseId, partnerId },
  );
  if (!release) throw new SchoolInputError("Published version not found.", 404);
  await writeClient()
    .transaction()
    .patch(partnerId, (p) =>
      p
        .ifRevisionId(revision)
        .set({
          approvedVersion: release.approvedVersion,
          livePages: release.livePages,
          productionStatus: "live",
          publishedReleaseId: releaseId,
          approvedAt: new Date().toISOString(),
          approvedBy: actorId,
        }),
    )
    .create(audit(partnerId, actorId, "restored", { releaseId }))
    .commit();
  return schoolEditor(partnerId);
}
export async function updateSchoolStatus(
  partnerId: string,
  revision: string,
  changes: { portalEnabled?: boolean; productionStatus?: "paused" },
  actorId: string,
) {
  requireRevision(revision);
  await writeClient()
    .transaction()
    .patch(partnerId, (p) => p.ifRevisionId(revision).set(changes))
    .create(audit(partnerId, actorId, "status_changed", changes))
    .commit();
  return schoolEditor(partnerId);
}
export async function createSalesPreview(partnerId: string, revision: string, actorId: string) {
  const { live, draft } = await schoolPair(partnerId);
  const current = draft ?? live!;
  if (current._rev !== requireRevision(revision))
    throw new SchoolInputError("Reload this school before creating its preview.", 409);
  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
  let tx = writeClient().transaction();
  if (live)
    tx = tx.patch(partnerId, (p) =>
      p
        .ifRevisionId(live._rev)
        .set({ salesPreviewTokenHash: hashPreviewToken(token), salesPreviewExpiresAt: expiresAt }),
    );
  else {
    const { _rev, _createdAt, _updatedAt, ...copy } = current;
    tx = tx
      .patch(current._id, (p) =>
        p.ifRevisionId(current._rev).set({ managementUpdatedAt: new Date().toISOString() }),
      )
      .create({
        ...copy,
        _id: partnerId,
        managementVersion: 2,
        productionStatus: "draft",
        portalEnabled: false,
        salesPreviewTokenHash: hashPreviewToken(token),
        salesPreviewExpiresAt: expiresAt,
      } as any);
  }
  await tx.create(audit(partnerId, actorId, "preview_created", { expiresAt })).commit();
  return { token, expiresAt, school: await schoolEditor(partnerId) };
}
/** Give a retained draft an application identity before inviting its school. */
export async function prepareSchoolHandoff(partnerId: string, revision: string, actorId: string) {
  const { live, draft } = await schoolPair(partnerId);
  const current = draft ?? live!;
  if (current._rev !== requireRevision(revision))
    throw new SchoolInputError("Reload this school before preparing access.", 409);
  const slug = schoolSlug(current.slug?.current);
  const duplicate = await client().fetch<string | null>(
    `*[_type=="school" && slug.current==$slug && !(_id in [$id,$draftId])][0]._id`,
    { slug, id: partnerId, draftId: `drafts.${partnerId}` },
  );
  if (duplicate)
    throw new SchoolInputError(
      "Another record uses this page address. Resolve the duplicate before inviting the school.",
      409,
    );
  if (live) return schoolEditor(partnerId);
  const { _rev, _createdAt, _updatedAt, ...copy } = current;
  await writeClient()
    .transaction()
    .patch(current._id, (p) =>
      p.ifRevisionId(current._rev).set({ managementUpdatedAt: new Date().toISOString() }),
    )
    .create({
      ...copy,
      _id: partnerId,
      managementVersion: 2,
      productionStatus: "draft",
      portalEnabled: false,
      reviewStatus: "draft",
    } as any)
    .create(audit(partnerId, actorId, "handoff_prepared"))
    .commit();
  return schoolEditor(partnerId);
}
export const hashPreviewToken = (token: string) => createHash("sha256").update(token).digest("hex");
export async function resolveSalesPreview(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return null;
  return client().fetch<{ partnerId: string } | null>(
    `*[_type=="school" && !(_id in path("drafts.**")) && salesPreviewTokenHash==$hash && salesPreviewExpiresAt>$now][0]{"partnerId":_id}`,
    { hash: hashPreviewToken(token), now: new Date().toISOString() },
  );
}
