/** Pure contracts for the partner CMS. Storage and identity stay server-side. */
export const SCHOOL_TEXT_FIELDS = {
  name: 180,
  short: 100,
  mascot: 100,
  fund: 180,
  city: 100,
  state: 100,
  fundShort: 100,
  beneficiary: 200,
  whyGiveHeading: 160,
  whyGiveBody: 4000,
  videoUrl: 1000,
  videoHeading: 160,
  videoCaption: 1000,
} as const;
export const SCHOOL_BOOLEAN_FIELDS = [
  "logoBadge",
  "whiteHeader",
  "logoLockup",
  "headerHug",
  "headerPadding",
  "tiersToBeAnnounced",
] as const;
export const SCHOOL_COLORS = [
  "primary",
  "secondary",
  "ink",
  "onAccent",
  "primaryDarkOverride",
] as const;
export class SchoolInputError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function canonicalPartnerId(value: unknown): string {
  if (
    typeof value !== "string" ||
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(value) ||
    value.startsWith("drafts.") ||
    value.startsWith("versions.")
  )
    throw new SchoolInputError("Choose a valid school.");
  return value;
}
export function schoolSlug(value: unknown): string {
  if (typeof value !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) || value.length > 100)
    throw new SchoolInputError("Use a page address with lowercase letters, numbers and hyphens.");
  return value;
}
const object = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === "object" && !Array.isArray(v));
/** Allowlisted patches cannot replace credentials, identity, approval or unknown data. */
export function validateSchoolChanges(value: unknown): Record<string, unknown> {
  if (!object(value)) throw new SchoolInputError("Enter school details.");
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (Object.hasOwn(SCHOOL_TEXT_FIELDS, key)) {
      if (
        typeof v !== "string" ||
        v.length > SCHOOL_TEXT_FIELDS[key as keyof typeof SCHOOL_TEXT_FIELDS]
      )
        throw new SchoolInputError(`Check ${key}: the value is too long or invalid.`);
      if (["name", "short", "mascot", "fund"].includes(key) && !v.trim())
        throw new SchoolInputError("School name, short name, mascot and fund are required.");
      if (key === "videoUrl" && v.trim()) {
        try {
          const u = new URL(v);
          if (u.protocol !== "https:") throw 0;
        } catch {
          throw new SchoolInputError("Use an HTTPS video address.");
        }
      }
      result[key] = v.trim();
    } else if ((SCHOOL_BOOLEAN_FIELDS as readonly string[]).includes(key)) {
      if (typeof v !== "boolean") throw new SchoolInputError(`Check ${key}.`);
      result[key] = v;
    } else if (key === "theme") {
      if (!object(v)) throw new SchoolInputError("Check the school colors.");
      for (const [color, hex] of Object.entries(v)) {
        if (
          !(SCHOOL_COLORS as readonly string[]).includes(color) ||
          (hex !== null &&
            (typeof hex !== "string" || (hex !== "" && !/^#[a-fA-F0-9]{6}$/.test(hex))))
        )
          throw new SchoolInputError("Colors must use six-digit hex values.");
        result[`theme.${color}`] = hex || null;
      }
    } else if (key === "logoSize") {
      if (typeof v !== "string" || !["sm", "md", "lg", "xl", "2xl", "custom"].includes(v))
        throw new SchoolInputError("Choose a logo size.");
      result[key] = v;
    } else if (key === "logoHeight") {
      if (typeof v !== "number" || !Number.isInteger(v) || v < 24 || v > 120)
        throw new SchoolInputError("Logo height must be between 24 and 120.");
      result[key] = v;
    } else if (key === "ambassadorTiers" || key === "ambassadorPrograms") {
      if (!Array.isArray(v) || v.length > 12)
        throw new SchoolInputError("Use up to twelve program entries.");
      result[key] = v.map((entry, index) => {
        if (!object(entry)) throw new SchoolInputError("Check the program entries.");
        const limits =
          key === "ambassadorTiers" ? { name: 100, role: 300 } : { title: 160, body: 2000 };
        const expectedType = key === "ambassadorTiers" ? "tier" : "program";
        const allowed =
          key === "ambassadorTiers"
            ? ["_key", "_type", "name", "role", "perks", "highlight"]
            : ["_key", "_type", "title", "body"];
        if (Object.keys(entry).some((k) => !allowed.includes(k)))
          throw new SchoolInputError("Unsupported program field.");
        if (entry._type !== undefined && entry._type !== expectedType)
          throw new SchoolInputError("Unsupported program entry type.");
        const out: Record<string, unknown> = {
          _type: expectedType,
          _key:
            typeof entry._key === "string" && /^[\w-]{1,80}$/.test(entry._key)
              ? entry._key
              : `item-${index}`,
        };
        for (const [field, max] of Object.entries(limits)) {
          if (
            entry[field] !== undefined &&
            (typeof entry[field] !== "string" || (entry[field] as string).length > max)
          )
            throw new SchoolInputError("Check program text length.");
          out[field] = entry[field] ?? "";
        }
        if (!(out.name || out.title)) throw new SchoolInputError("Give each program entry a name.");
        if (key === "ambassadorTiers") {
          if (
            entry.perks !== undefined &&
            (!Array.isArray(entry.perks) ||
              entry.perks.length > 12 ||
              entry.perks.some((p) => typeof p !== "string" || p.length > 300))
          )
            throw new SchoolInputError("Check benefit descriptions.");
          out.perks = entry.perks ?? [];
          out.highlight = entry.highlight === true;
        }
        return out;
      });
    } else throw new SchoolInputError(`The field ${key} cannot be changed here.`);
  }
  if (!Object.keys(result).length) throw new SchoolInputError("There are no changes to save.");
  return result;
}
const PROTECTED = new Set([
  "portalToken",
  "portalTokenCreatedAt",
  "portalEnabled",
  "clerkOrgId",
  "productionStatus",
  "approvedVersion",
  "approvedAt",
  "approvedBy",
  "livePages",
  "salesPreviewTokenHash",
  "salesPreviewExpiresAt",
  "managementVersion",
  "managementMigratedAt",
  "managementMigrationId",
  "managementUpdatedAt",
  "managementUpdatedBy",
  "reviewStatus",
  "publishedReleaseId",
]);
/** Sanity document identity/system fields never cross into content replacement. */
export function schoolContent(doc: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(doc).filter(([k]) => !k.startsWith("_") && !PROTECTED.has(k)),
  );
}
export function safeEditorFields(doc: Record<string, unknown>): Record<string, unknown> {
  const fields = Object.fromEntries(
    Object.entries(doc).filter(
      ([k]) =>
        Object.hasOwn(SCHOOL_TEXT_FIELDS, k) ||
        (SCHOOL_BOOLEAN_FIELDS as readonly string[]).includes(k) ||
        ["theme", "logoSize", "logoHeight", "ambassadorTiers", "ambassadorPrograms"].includes(k),
    ),
  );
  if (object(fields.theme))
    fields.theme = Object.fromEntries(
      Object.entries(fields.theme).filter(([k]) =>
        (SCHOOL_COLORS as readonly string[]).includes(k),
      ),
    );
  for (const key of ["ambassadorTiers", "ambassadorPrograms"])
    if (Array.isArray(fields[key])) {
      const allowed =
        key === "ambassadorTiers"
          ? ["_key", "_type", "name", "role", "perks", "highlight"]
          : ["_key", "_type", "title", "body"];
      fields[key] = fields[key].map((entry) =>
        object(entry)
          ? Object.fromEntries(Object.entries(entry).filter(([k]) => allowed.includes(k)))
          : entry,
      );
    }
  return fields;
}
export function requireRevision(value: unknown): string {
  if (typeof value !== "string" || !/^[\w-]{1,128}$/.test(value))
    throw new SchoolInputError("Reload this school before saving.", 409);
  return value;
}
