import { EyeOpenIcon } from "@sanity/icons";
import type { DocumentActionComponent } from "sanity";

// "Open preview" document actions — open the site's secret-gated draft-preview
// routes in a new tab so editors can see unpublished changes on the real page
// before publishing.
//
// Config (Studio env, prefixed SANITY_STUDIO_ so Vite exposes them):
//   SANITY_STUDIO_PREVIEW_ORIGIN — where the preview routes are deployed
//                                  (falls back to production).
//   SANITY_STUDIO_PREVIEW_SECRET — must match the site's PREVIEW_SECRET env var.
//
// NOTE: Studio env vars are bundled into the (publicly served) Studio JS, so this
// secret is obscurity-level protection. Fine for draft school/legal pages; upgrade
// to @sanity/preview-url-secret (per-click, dataset-verified) for stronger gating.
const PREVIEW_ORIGIN =
  import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";
const PREVIEW_SECRET = import.meta.env.SANITY_STUDIO_PREVIEW_SECRET ?? "";

/**
 * Build an "Open preview" document action.
 * @param label   Button label.
 * @param pathFor Given the doc's slug, return the site path to open.
 */
function makePreviewAction(
  label: string,
  pathFor: (slug: string) => string,
): DocumentActionComponent {
  return (props) => {
    const slug =
      (props.draft as any)?.slug?.current ??
      (props.published as any)?.slug?.current;

    return {
      label,
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
        const url = `${PREVIEW_ORIGIN}${pathFor(slug)}?secret=${encodeURIComponent(
          PREVIEW_SECRET,
        )}`;
        window.open(url, "_blank", "noopener,noreferrer");
        props.onComplete();
      },
    };
  };
}

// School docs get two previews (donor + ambassador); legal docs get one.
export const schoolDonorPreview = makePreviewAction(
  "Open preview",
  (slug) => `/preview/schools/${slug}`,
);
export const schoolAmbassadorPreview = makePreviewAction(
  "Preview ambassador page",
  (slug) => `/preview/schools/${slug}/ambassadors`,
);
export const legalPreview = makePreviewAction(
  "Open preview",
  (slug) => `/preview/legal/${slug}`,
);
