export const prerender = false;
import type { APIRoute } from "astro";
import { getPortalIdentity } from "@/lib/portalAuth";
import { canAdministerPartners, portalJson, requireSameOrigin } from "@/lib/portalPermissions";
import { canonicalPartnerId, SchoolInputError } from "@/lib/schoolManagement";
import {
  listManagedSchools,
  schoolEditor,
  createManagedSchool,
  saveSchool,
  publishSchool,
  createSalesPreview,
  restoreSchoolRelease,
  updateSchoolStatus,
  prepareSchoolHandoff,
} from "@/data/schoolManagementStore";
const failure = (error: unknown) => {
  if (error instanceof SchoolInputError)
    return portalJson({ message: error.message }, error.status);
  if ((error as any)?.statusCode === 409)
    return portalJson({ message: "Someone changed this school. Reload before trying again." }, 409);
  console.error("School management failed");
  return portalJson(
    { message: "School management is temporarily unavailable. Please try again." },
    503,
  );
};
export const GET: APIRoute = async (ctx) => {
  try {
    const identity = await getPortalIdentity(ctx);
    if (!canAdministerPartners(identity))
      return portalJson({ message: "Sign in with an XtraPoint administrator account." }, 403);
    const id = ctx.url.searchParams.get("partnerId");
    return portalJson(
      id
        ? await schoolEditor(canonicalPartnerId(id))
        : await listManagedSchools(
            ctx.url.searchParams.get("q") ?? "",
            ctx.url.searchParams.get("after") ?? "",
          ),
    );
  } catch (error) {
    return failure(error);
  }
};
export const POST: APIRoute = async (ctx) => {
  const denied = requireSameOrigin(ctx.request, ctx.url);
  if (denied) return denied;
  try {
    const identity = await getPortalIdentity(ctx);
    if (!canAdministerPartners(identity))
      return portalJson({ message: "Sign in with an XtraPoint administrator account." }, 403);
    if (Number(ctx.request.headers.get("content-length") ?? 0) > 64000)
      return portalJson({ message: "School details are too large." }, 413);
    let body;
    try {
      body = await ctx.request.json();
    } catch {
      return portalJson({ message: "Enter valid school details." }, 400);
    }
    if (!body || typeof body !== "object")
      return portalJson({ message: "Enter school details." }, 400);
    if (body.action === "create")
      return portalJson(await createManagedSchool(body, identity!.userId), 201);
    const id = canonicalPartnerId(body.partnerId);
    let result;
    switch (body.action) {
      case "save":
        result = await saveSchool(id, body.revision, body.fields, identity!.userId);
        break;
      case "preview":
        result = await createSalesPreview(id, body.revision, identity!.userId);
        break;
      case "prepare":
        result = await prepareSchoolHandoff(id, body.revision, identity!.userId);
        break;
      case "publish":
        if (body.partnerApproved !== true)
          throw new SchoolInputError("Confirm that the school approved this exact version.");
        if (
          typeof body.livePages?.donor !== "boolean" ||
          typeof body.livePages?.ambassador !== "boolean"
        )
          throw new SchoolInputError("Choose which pages to publish.");
        result = await publishSchool(
          id,
          body.revision,
          body.publishedRevision,
          body.livePages,
          identity!.userId,
        );
        break;
      case "restore":
        result = await restoreSchoolRelease(
          id,
          body.publishedRevision,
          body.releaseId,
          identity!.userId,
        );
        break;
      case "access":
        if (typeof body.enabled !== "boolean")
          throw new SchoolInputError("Choose an access state.");
        result = await updateSchoolStatus(
          id,
          body.publishedRevision,
          { portalEnabled: body.enabled },
          identity!.userId,
        );
        break;
      case "pause":
        result = await updateSchoolStatus(
          id,
          body.publishedRevision,
          { productionStatus: "paused" },
          identity!.userId,
        );
        break;
      default:
        throw new SchoolInputError("Choose an available school action.");
    }
    return portalJson(result);
  } catch (error) {
    return failure(error);
  }
};
