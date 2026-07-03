import { EyeOpenIcon } from "@sanity/icons";
import type { DocumentActionComponent } from "sanity";

// "Open preview" document action for school docs. Opens the site's secret-gated
// draft-preview route (/preview/schools/<slug>) in a new tab, so editors can see
// unpublished changes rendered on the real page before publishing.
//
// Config (Studio env, prefixed SANITY_STUDIO_ so Vite exposes them):
//   SANITY_STUDIO_PREVIEW_ORIGIN — where the preview route is deployed
//                                  (e.g. https://www.xtrapoint.com). Falls back
//                                  to production.
//   SANITY_STUDIO_PREVIEW_SECRET — must match the site's PREVIEW_SECRET env var.
//
// NOTE: Studio env vars are bundled into the (publicly served) Studio JS, so this
// secret is obscurity-level protection. Fine for draft school pages; upgrade to
// @sanity/preview-url-secret (per-click, dataset-verified) if stronger gating is
// needed. The preview route also sends noindex and 401s without the secret.
const PREVIEW_ORIGIN =
  import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";
const PREVIEW_SECRET = import.meta.env.SANITY_STUDIO_PREVIEW_SECRET ?? "";

export const openPreviewAction: DocumentActionComponent = (props) => {
  // Prefer the draft's slug (what's being edited), else the published one.
  const slug =
    (props.draft as any)?.slug?.current ??
    (props.published as any)?.slug?.current;

  return {
    label: "Open preview",
    icon: EyeOpenIcon,
    onHandle: () => {
      if (!slug) {
        window.alert("Add and save a slug first, then open the preview.");
        props.onComplete();
        return;
      }
      if (!PREVIEW_SECRET) {
        window.alert(
          "Preview isn't configured: set SANITY_STUDIO_PREVIEW_SECRET (matching the site's PREVIEW_SECRET) and redeploy the Studio.",
        );
        props.onComplete();
        return;
      }
      const url = `${PREVIEW_ORIGIN}/preview/schools/${slug}?secret=${encodeURIComponent(
        PREVIEW_SECRET,
      )}`;
      window.open(url, "_blank", "noopener,noreferrer");
      props.onComplete();
    },
  };
};
