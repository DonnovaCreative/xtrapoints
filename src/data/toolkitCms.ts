// SERVER ONLY. Never render mutable editorial articles directly: the public
// article package and gated downloads must be the same reviewed edition.
import { createHash } from "node:crypto";
import { createClient } from "@sanity/client";
import bundledPublication from "./toolkit/content.json" with { type: "json" };

export type ToolkitPublication = typeof bundledPublication;
export interface ToolkitReleaseDocument {
  _id: string;
  version: string;
  revision: string;
  releaseDate: string;
  status: string;
  approvedAt?: string;
  approvedBy?: string;
  snapshotSha256: string;
  publicationSnapshot: string;
  formats: Array<{ resourceId: string; filename: string; format: string; sha256: string; bytes: number; source: string }>;
  sourceHashes: Array<{ path: string; sha256: string }>;
}

export interface ToolkitPublicationSelection {
  toolkit: ToolkitPublication;
  origin: "cms" | "bundled";
  releaseId?: string;
  reason?: "not_configured" | "no_matching_approved_release" | "cms_unavailable";
}

const stable = (value: unknown): string => {
  if (value === undefined) return "undefined";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stable(object[key])}`).join(",")}}`;
};
export const publicationHash = (value: unknown): string => createHash("sha256").update(stable(value)).digest("hex");

/** Fail closed on mixed prose/download versions; use the intact local release. */
export function validateToolkitRelease(
  release: ToolkitReleaseDocument,
  bundled: ToolkitPublication = bundledPublication,
): ToolkitPublication | undefined {
  if (!release || release._id !== `xp-toolkit.release.${bundled.release.revision}` ||
      release.status !== "approved" || typeof release.approvedBy !== "string" || !release.approvedBy.trim() || !release.approvedAt ||
      !Number.isFinite(Date.parse(release.approvedAt))) return;
  if (release.version !== bundled.release.version || release.revision !== bundled.release.revision || release.releaseDate !== bundled.release.date) return;
  if (release.snapshotSha256 !== publicationHash(bundled)) return;
  let snapshot: ToolkitPublication;
  try { snapshot = JSON.parse(release.publicationSnapshot); } catch { return; }
  if (!snapshot || snapshot.generated !== true || publicationHash(snapshot) !== release.snapshotSha256) return;
  if (!Array.isArray(release.formats) || release.formats.length !== 6 || !Array.isArray(release.sourceHashes)) return;
  if (release.formats.some((format) => !format || typeof format !== "object") ||
      release.sourceHashes.some((entry) => !entry || typeof entry !== "object")) return;
  const downloads = bundled.downloadHashes as Record<string, { sha256: string; bytes: number }>;
  for (const resource of bundled.resources) {
    const matches = release.formats.filter((format) => format.resourceId === resource.id);
    const format = matches[0];
    const expected = downloads[resource.id];
    if (matches.length !== 1 || format.source !== "bundled" || format.filename !== resource.download.filename ||
        format.format !== resource.format || format.sha256 !== expected.sha256 || format.bytes !== expected.bytes) return;
  }
  const sourceEntries = Object.entries(bundled.sourceHashes);
  if (release.sourceHashes.length !== sourceEntries.length || sourceEntries.some(([sourcePath, hash]) =>
    release.sourceHashes.filter((entry) => entry.path === sourcePath && entry.sha256 === hash).length !== 1)) return;
  return snapshot;
}

export function selectToolkitPublication(
  releases: ToolkitReleaseDocument[],
  bundled: ToolkitPublication = bundledPublication,
): ToolkitPublicationSelection {
  for (const release of releases) {
    const snapshot = validateToolkitRelease(release, bundled);
    if (snapshot) return { toolkit: snapshot, origin: "cms", releaseId: release._id };
  }
  return { toolkit: bundled, origin: "bundled", reason: "no_matching_approved_release" };
}

const env = (key: string): string | undefined => process.env[key] ??
  (import.meta.env as Record<string, string | undefined> | undefined)?.[key];
let cached: { until: number; promise: Promise<ToolkitPublicationSelection> } | undefined;

/**
 * The deployed content.json is the output contract for the six shipped binary
 * files. A CMS edition is eligible only after the same complete generated
 * package is deployed. Until explicit editorial cutover, retained masters remain
 * canonical; CMS article edits are proposals and do not bypass regeneration.
 */
export async function getToolkitPublication(): Promise<ToolkitPublicationSelection> {
  const token = env("SANITY_READ_TOKEN");
  if (!token) return { toolkit: bundledPublication, origin: "bundled", reason: "not_configured" };
  if (cached && cached.until > Date.now()) return cached.promise;
  const promise = (async (): Promise<ToolkitPublicationSelection> => {
    try {
      const client = createClient({
        projectId: env("SANITY_PROJECT_ID") || "xjhhxbqk", dataset: env("SANITY_DATASET") || "production",
        apiVersion: "2025-02-19", useCdn: false, perspective: "published", token, timeout: 5_000, maxRetries: 0,
      });
      const releases = await client.fetch<ToolkitReleaseDocument[]>(
        `*[_type == "xpToolkitRelease" && !(_id in path("drafts.**")) && !(_id in path("versions.**")) && status == "approved" && revision == $revision] | order(approvedAt desc) [0...5] {
          _id, version, revision, releaseDate, status, approvedAt, approvedBy,
          snapshotSha256, publicationSnapshot, formats, sourceHashes
        }`,
        { revision: bundledPublication.release.revision },
      );
      return selectToolkitPublication(releases);
    } catch {
      // The verified bundle remains usable during an editorial CMS outage.
      // Do not log SDK exceptions, which can contain credential/request data.
      return { toolkit: bundledPublication, origin: "bundled", reason: "cms_unavailable" };
    }
  })();
  cached = { until: Date.now() + 60_000, promise };
  return promise;
}

export function toolkitPublicationHelpers(toolkit: ToolkitPublication) {
  return {
    resourceById: (id?: string) => toolkit.resources.find((resource) => resource.id === id),
    articlesFor: (resource: string) => toolkit.articles.filter((article) => article.resource === resource),
    articleById: (resource: string, id?: string) => toolkit.articles.find((article) => article.resource === resource && article.id === id),
  };
}
