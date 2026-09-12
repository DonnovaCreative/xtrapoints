import { EditIcon } from "@sanity/icons";
import type { DocumentActionComponent, DocumentActionProps } from "sanity";

const origin = import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";
const managed = (props: DocumentActionProps) => Number(props.draft?.managementVersion ?? props.published?.managementVersion ?? 0) >= 2;

/** Keep legacy actions for unmigrated documents. Managed schools use the
 * application's revision-aware lifecycle for every write and preview. */
export function legacySchoolAction(action: DocumentActionComponent): DocumentActionComponent {
  const guarded: DocumentActionComponent = props => {
    // Preserve action hook order if this document is migrated while open.
    const description = action(props);
    return managed(props) ? null : description;
  };
  guarded.action = action.action;
  guarded.displayName = `LegacySchool${action.displayName ?? action.name ?? "Action"}`;
  return guarded;
}

export const manageSchoolAction: DocumentActionComponent = props => managed(props) ? {
  label: "Open School administration",
  icon: EditIcon,
  onHandle() {
    const id = props.id.replace(/^drafts\./, "");
    window.open(`${origin}/admin/schools/${encodeURIComponent(id)}`, "_blank", "noopener,noreferrer");
    props.onComplete();
  },
} : null;
