export interface BrandSnapshot {
  revision?: string;
  colors: Record<string, string | null>;
  images: Record<string, string | null>;
  credits?: Record<string, string | null>;
  submittedForReview?: boolean;
  pending?: boolean;
}

export interface BrandEditorDraft {
  saved: BrandSnapshot;
  colors: Record<string, string>;
  credits: Record<string, string>;
}

export interface ConfirmedBrandChanges {
  colors?: Record<string, string>;
  credits?: Record<string, string>;
}

/** Refresh the revision and previews without replacing another field's local edits. */
export function refreshBrandDraft(
  current: BrandEditorDraft | null,
  saved: BrandSnapshot,
  colorKeys: string[],
  creditKeys: string[],
  confirmed: ConfirmedBrandChanges = {},
): BrandEditorDraft {
  const merge = (group: "colors" | "credits", keys: string[]) => Object.fromEntries(keys.map(key => {
    const local = current?.[group][key] ?? "";
    const previous = current?.saved[group]?.[key] ?? "";
    const wasSaved = confirmed[group]?.[key] !== undefined && local === confirmed[group]?.[key];
    const keepLocal = current !== null && local !== previous && !wasSaved;
    return [key, keepLocal ? local : saved[group]?.[key] ?? ""];
  }));
  return { saved, colors: merge("colors", colorKeys), credits: merge("credits", creditKeys) };
}

export function brandDraftChanges(draft: BrandEditorDraft | null) {
  const changed = (group: "colors" | "credits") => Boolean(draft && Object.entries(draft[group])
    .some(([key, value]) => value !== (draft.saved[group]?.[key] ?? "")));
  return { colors: changed("colors"), credits: changed("credits") };
}
