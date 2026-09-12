// Server/CLI-only, deterministic migration planning. Never project school
// records through a presentation model: unknown fields and drafts must survive.
import { createHash } from "node:crypto";

export interface RawDocument {
  _id: string;
  _type: string;
  _rev?: string;
  [key: string]: unknown;
}

export const SCHOOL_DOCUMENT_TYPES = ["school", "templateOverride"] as const;
export const MANAGEMENT_FIELDS = [
  "managementVersion", "clerkOrgId", "managementMigratedAt", "managementMigrationId",
] as const;

/** Stable JSON changes no values; object property ordering is not meaningful. */
export function canonicalJson(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
  ).join(",")}}`;
}

export const recordHash = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

export function partnerIdFor(documentId: string): string {
  if (!documentId || documentId.startsWith("versions.")) {
    throw new Error("A partner ID must come from a published school ID or its draft");
  }
  return documentId.startsWith("drafts.") ? documentId.slice(7) : documentId;
}

/** JSON pointer paths only: reports must not print portal or preview tokens. */
export function changedPaths(before: unknown, after: unknown, path = ""): string[] {
  if (canonicalJson(before) === canonicalJson(after)) return [];
  if (before && after && typeof before === "object" && typeof after === "object" &&
      !Array.isArray(before) && !Array.isArray(after)) {
    const a = before as Record<string, unknown>;
    const b = after as Record<string, unknown>;
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].sort().flatMap((key) =>
      changedPaths(a[key], b[key], `${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`),
    );
  }
  return [path || "/"];
}

export function collectAssetDependencies(value: unknown): { refs: string[]; urls: string[] } {
  const refs = new Set<string>();
  const urls = new Set<string>();
  function walk(item: unknown): void {
    if (typeof item === "string") {
      // approvedVersion is intentionally retained as a string, but its resolved
      // asset URLs need a backup even when the live image was later replaced.
      if (item.trimStart().startsWith("{") || item.trimStart().startsWith("[")) {
        try { walk(JSON.parse(item)); } catch { /* not JSON; preserve verbatim */ }
      }
      try {
        const url = new URL(item);
        if (url.protocol === "https:" && url.hostname === "cdn.sanity.io" &&
            /^\/(images|files)\//.test(url.pathname)) {
          url.search = ""; url.hash = "";
          urls.add(url.toString());
        }
      } catch { /* ordinary text */ }
      return;
    }
    if (Array.isArray(item)) { item.forEach(walk); return; }
    if (!item || typeof item !== "object") return;
    const object = item as Record<string, unknown>;
    if (typeof object._ref === "string" && /^(image|file)-/.test(object._ref)) refs.add(object._ref);
    Object.values(object).forEach(walk);
  }
  walk(value);
  return { refs: [...refs].sort(), urls: [...urls].sort() };
}

export interface MigrationIssue {
  severity: "error" | "warning";
  code: string;
  documentIds: string[];
}
export interface MigrationEntry {
  id: string;
  partnerId: string;
  revision?: string;
  beforeHash: string;
  afterHash: string;
  set: Record<string, unknown>;
  changedPaths: string[];
}
export interface SchoolMigrationPlan {
  formatVersion: 1;
  migrationId: string;
  plannedAt: string;
  sourceHash: string;
  entries: MigrationEntry[];
  issues: MigrationIssue[];
  ready: boolean;
}

const slugOf = (doc: RawDocument): string | undefined => {
  const slug = doc.slug as { current?: unknown } | undefined;
  return typeof slug?.current === "string" && slug.current.length ? slug.current : undefined;
};

/** Add management metadata only; an org association always requires input. */
export function planSchoolMigration(
  documents: RawDocument[],
  options: { migrationId: string; plannedAt: string; orgByPartnerId?: Record<string, string> },
): SchoolMigrationPlan {
  if (!options.migrationId || !Number.isFinite(Date.parse(options.plannedAt))) {
    throw new Error("A migration ID and valid ISO planning time are required");
  }
  const issues: MigrationIssue[] = [];
  const issue = (severity: MigrationIssue["severity"], code: string, ids: string[]) =>
    issues.push({ severity, code, documentIds: [...ids].sort() });
  const sorted = [...documents].sort((a, b) => a._id.localeCompare(b._id));
  const ids = new Set<string>();
  for (const doc of sorted) {
    if (!doc._id || !doc._type) throw new Error("Backup contains a record without _id or _type");
    if (ids.has(doc._id)) issue("error", "duplicate_document_id", [doc._id]);
    ids.add(doc._id);
  }
  const schools = sorted.filter((doc) => doc._type === "school" && !doc._id.startsWith("versions."));
  const partners = new Map<string, RawDocument[]>();
  const slugOwners = new Map<string, Set<string>>();
  for (const doc of schools) {
    const partnerId = partnerIdFor(doc._id);
    partners.set(partnerId, [...(partners.get(partnerId) ?? []), doc]);
    const slug = slugOf(doc);
    if (!slug) issue("warning", "missing_slug", [doc._id]);
    else slugOwners.set(slug, new Set([...(slugOwners.get(slug) ?? []), partnerId]));
    if (!doc._rev) issue("error", "missing_revision", [doc._id]);
    if (doc.approvedVersion !== undefined) {
      try {
        const snapshot = typeof doc.approvedVersion === "string" ? JSON.parse(doc.approvedVersion) : null;
        if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error();
        if (typeof snapshot.slug === "string" && slug && snapshot.slug !== slug) {
          issue("warning", "approved_slug_differs", [doc._id]);
        }
      } catch { issue("warning", "invalid_approved_snapshot", [doc._id]); }
    } else if (doc.productionStatus === "live") issue("warning", "live_without_snapshot", [doc._id]);
  }
  for (const owners of slugOwners.values()) {
    if (owners.size > 1) issue("error", "duplicate_school_slug", [...owners]);
  }
  for (const [partnerId, pair] of partners) {
    if (pair.every((doc) => doc._id.startsWith("drafts."))) issue("warning", "draft_only_school", [partnerId]);
  }
  for (const doc of sorted.filter((item) => item._id.startsWith("versions."))) {
    issue("warning", "release_version_preserved_not_migrated", [doc._id]);
  }
  for (const doc of sorted.filter((item) => item._type === "templateOverride")) {
    if (typeof doc.schoolSlug !== "string" || !slugOwners.has(doc.schoolSlug)) {
      issue("warning", "orphan_template_override", [doc._id]);
    }
  }
  const orgOwners = new Map<string, Set<string>>();
  for (const [partnerId, orgId] of Object.entries(options.orgByPartnerId ?? {})) {
    if (!partners.has(partnerId)) issue("error", "unknown_mapping_partner", [partnerId]);
    if (typeof orgId !== "string" || !/^org_[A-Za-z0-9]+$/.test(orgId)) issue("error", "invalid_clerk_org_id", [partnerId]);
  }
  for (const [partnerId, pair] of partners) {
    const orgIds = new Set(pair.map((doc) => doc.clerkOrgId).filter((id) => id !== undefined));
    const requested = options.orgByPartnerId?.[partnerId];
    if (requested !== undefined) orgIds.add(requested);
    if (orgIds.size > 1) issue("error", "conflicting_clerk_org_binding", pair.map((doc) => doc._id));
    for (const orgId of orgIds) {
      if (typeof orgId !== "string" || !/^org_[A-Za-z0-9]+$/.test(orgId)) {
        issue("error", "invalid_clerk_org_id", [partnerId]); continue;
      }
      orgOwners.set(orgId, new Set([...(orgOwners.get(orgId) ?? []), partnerId]));
    }
  }
  for (const owners of orgOwners.values()) {
    if (owners.size > 1) issue("error", "clerk_org_bound_to_multiple_partners", [...owners]);
  }
  const entries = schools.map((doc): MigrationEntry => {
    const partnerId = partnerIdFor(doc._id);
    const set: Record<string, unknown> = {};
    if (doc.managementVersion !== undefined && doc.managementVersion !== 1 && doc.managementVersion !== 2) {
      issue("error", "unsupported_management_version", [doc._id]);
    } else if (doc.managementVersion !== 2) {
      set.managementVersion = 2;
      if (doc.managementMigratedAt === undefined) set.managementMigratedAt = options.plannedAt;
      if (doc.managementMigrationId === undefined) set.managementMigrationId = options.migrationId;
    }
    const orgId = options.orgByPartnerId?.[partnerId];
    if (orgId !== undefined && doc.clerkOrgId === undefined) set.clerkOrgId = orgId;
    const after = { ...doc, ...set };
    return {
      id: doc._id, partnerId, revision: doc._rev,
      beforeHash: recordHash(doc), afterHash: recordHash(after), set,
      changedPaths: changedPaths(doc, after),
    };
  });
  return {
    formatVersion: 1, migrationId: options.migrationId, plannedAt: options.plannedAt,
    sourceHash: recordHash(sorted), entries, issues,
    ready: !issues.some((item) => item.severity === "error"),
  };
}

/** Pure replay validates the reviewed record and never mutates its input. */
export function replayMigrationEntry(doc: RawDocument, entry: MigrationEntry): RawDocument {
  if (doc._id !== entry.id || doc._rev !== entry.revision || recordHash(doc) !== entry.beforeHash) {
    throw new Error(`Record changed since planning: ${entry.id}`);
  }
  if (Object.keys(entry.set).some((key) => !MANAGEMENT_FIELDS.includes(key as typeof MANAGEMENT_FIELDS[number]))) {
    throw new Error("Migration contains a non-management field");
  }
  const result = JSON.parse(JSON.stringify({ ...doc, ...entry.set })) as RawDocument;
  if (recordHash(result) !== entry.afterHash) throw new Error(`Plan hash mismatch: ${entry.id}`);
  return result;
}

export function inventorySchools(documents: RawDocument[]) {
  const counts: Record<string, number> = {};
  const published = documents.filter((doc) => doc._type === "school" && !/^(drafts|versions)\./.test(doc._id));
  const drafts = documents.filter((doc) => doc._type === "school" && doc._id.startsWith("drafts."));
  for (const doc of documents) counts[doc._type] = (counts[doc._type] ?? 0) + 1;
  return {
    counts, publishedSchools: published.length, draftSchools: drafts.length,
    partners: new Set([...published, ...drafts].map((doc) => partnerIdFor(doc._id))).size,
    records: [...documents].sort((a, b) => a._id.localeCompare(b._id)).map((doc) => ({
      id: doc._id, type: doc._type, revision: doc._rev, sha256: recordHash(doc),
      assetReferences: collectAssetDependencies(doc).refs,
    })),
    draftDifferences: drafts.map((draft) => {
      const original = published.find((doc) => doc._id === partnerIdFor(draft._id));
      return { id: draft._id, publishedExists: !!original, changedPaths: original ? changedPaths(original, draft) : ["/"] };
    }),
  };
}
