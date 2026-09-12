export interface PermissionIdentity {
  isStaff: boolean;
  role?: string;
  orgId?: string;
  partnerId?: string;
  schoolSlug?: string;
}

export interface PortalPartner {
  _id: string;
  _rev: string;
  slug: string;
  name: string;
  portalEnabled?: boolean;
  clerkOrgId?: string;
}

export type PartnerAction = "read" | "edit";
export const PARTNER_ROLES = ["org:admin", "org:member", "org:editor", "org:viewer"] as const;
export type PartnerRole = (typeof PARTNER_ROLES)[number];
export const isPartnerRole = (value: unknown): value is PartnerRole =>
  typeof value === "string" && (PARTNER_ROLES as readonly string[]).includes(value);

/** Legacy members remain editors. Missing or unknown roles fail closed. */
export function canEditPartnerContent(identity: PermissionIdentity): boolean {
  return identity.role === "org:admin" || identity.role === "org:member" || identity.role === "org:editor";
}

/** Staff membership alone does not grant account administration. */
export function canAdministerPartners(identity: PermissionIdentity | undefined): boolean {
  return Boolean(identity?.isStaff && identity.role === "org:admin");
}

export function canAccessPartner(identity: PermissionIdentity, partner: PortalPartner, action: PartnerAction = "read"): boolean {
  if (!isPartnerRole(identity.role)) return false;
  if (action === "edit" && !canEditPartnerContent(identity)) return false;
  if (identity.isStaff) return true;
  if (partner.portalEnabled !== true) return false;
  if (partner.clerkOrgId && identity.orgId !== partner.clerkOrgId) return false;
  // Once assigned, an immutable ID is authoritative; stale/mismatched IDs must
  // never fall back to a matching URL slug.
  if (identity.partnerId) return identity.partnerId === partner._id;
  return Boolean(identity.schoolSlug && identity.schoolSlug === partner.slug);
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const portalJson = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex, nofollow",
      "referrer-policy": "no-referrer",
    },
  });

/** All session-authorized mutations require a same-origin browser request. */
export function requireSameOrigin(request: Request, url = new URL(request.url)): Response | null {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (origin !== url.origin || (site && site !== "same-origin")) {
    return portalJson({ error: "invalid_origin", message: "Open this page on the site and try again." }, 403);
  }
  return null;
}

/** Offset advances by received records, including provider-capped pages. */
export async function collectPaginated<T>(
  fetchPage: (params: { limit: number; offset: number }) => Promise<{ data: T[]; totalCount: number }>,
  limit = 100,
): Promise<T[]> {
  const records: T[] = [];
  let offset = 0;
  for (;;) {
    const page = await fetchPage({ limit, offset });
    if (!page.data.length) {
      if (offset < page.totalCount) throw new Error("Incomplete administrative list");
      break;
    }
    records.push(...page.data);
    offset += page.data.length;
    if (offset >= page.totalCount) break;
  }
  return records;
}
