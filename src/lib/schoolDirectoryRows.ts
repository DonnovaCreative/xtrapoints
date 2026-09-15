/** One directory row per partner, keeping its draft when both versions arrive.
 * Cursor pages may split a pair or return it in either order. Preserve the
 * partner's first position while newer rows of the same version replace older
 * ones; a later canonical row must never replace a previously loaded draft. */
export function mergeSchoolDirectoryRows<T extends { _id: string }>(rows: readonly T[]): T[] {
  const partners = new Map<string, T>();
  for (const row of rows) {
    const id = row._id.replace(/^drafts\./, "");
    const previous = partners.get(id);
    if (!previous || row._id.startsWith("drafts.") || !previous._id.startsWith("drafts.")) {
      partners.set(id, row);
    }
  }
  return [...partners.values()];
}
