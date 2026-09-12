export const prerender = false;
import type { APIRoute } from "astro";
import { resolvePortalPartner } from "@/lib/portalAuth";
import { portalJson, requireSameOrigin } from "@/lib/portalPermissions";
import {
  schoolEditor,
  saveSchool,
  setSchoolReview,
  publishSchool,
  restoreSchoolRelease,
} from "@/data/schoolManagementStore";
import { SchoolInputError } from "@/lib/schoolManagement";
export const GET: APIRoute = async (ctx) => {
  const access = await resolvePortalPartner(ctx, {
    school: ctx.url.searchParams.get("school") ?? undefined,
  });
  if ("error" in access) return access.error;
  try {
    return portalJson(await schoolEditor(access.partner._id));
  } catch {
    return portalJson({ message: "School details are unavailable. Try again." }, 503);
  }
};
export const POST: APIRoute = async (ctx) => {
  const denied = requireSameOrigin(ctx.request, ctx.url);
  if (denied) return denied;
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
  const access = await resolvePortalPartner(ctx, { school: body.school }, "edit");
  if ("error" in access) return access.error;
  try {
    if (body.action === "save")
      return portalJson(
        await saveSchool(access.partner._id, body.revision, body.fields, access.identity.userId),
      );
    if (body.action === "review")
      return portalJson(
        await setSchoolReview(access.partner._id, body.revision, access.identity.userId),
      );
    if (body.action === "publish" || body.action === "restore") {
      if (access.identity.role !== "org:admin")
        return portalJson({ message: "A school administrator must approve publication." }, 403);
      if (body.action === "restore")
        return portalJson(
          await restoreSchoolRelease(
            access.partner._id,
            body.publishedRevision,
            body.releaseId,
            access.identity.userId,
          ),
        );
      if (body.partnerApproved !== true)
        throw new SchoolInputError("Confirm that your organization approved this saved version.");
      if (
        typeof body.livePages?.donor !== "boolean" ||
        typeof body.livePages?.ambassador !== "boolean"
      )
        throw new SchoolInputError("Choose which pages to publish.");
      return portalJson(
        await publishSchool(
          access.partner._id,
          body.revision,
          body.publishedRevision,
          body.livePages,
          access.identity.userId,
        ),
      );
    }
    return portalJson({ message: "Choose an available action." }, 400);
  } catch (e) {
    return portalJson(
      {
        message:
          e instanceof SchoolInputError
            ? e.message
            : "Changes could not be saved. Reload the school and try again.",
      },
      e instanceof SchoolInputError ? e.status : (e as any)?.statusCode === 409 ? 409 : 503,
    );
  }
};
