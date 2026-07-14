import { DownloadIcon } from "@sanity/icons";
import { useClient } from "sanity";
import type { DocumentActionComponent } from "sanity";

// "Auto-fill from ESPN" document action for the `school` type — the browser
// equivalent of the terminal `seed:college` flow. Prompts for a college/team
// name, calls the site's /api/seed-college endpoint (which does the ESPN +
// Scorecard lookup server-side and proxies the logo), then PREFILLS the open
// draft: it uploads the logo under the editor's own session and setIfMissing's
// the fields (so it never clobbers anything already typed). Stays a draft.
//
// Config (Studio env, same vars as the preview button):
//   SANITY_STUDIO_PREVIEW_ORIGIN — where /api/seed-college is deployed.
//   SANITY_STUDIO_PREVIEW_SECRET — must match the site's PREVIEW_SECRET.
const ORIGIN =
  import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";
const SECRET = import.meta.env.SANITY_STUDIO_PREVIEW_SECRET ?? "";

export const collegeAutofillAction: DocumentActionComponent = (props) => {
  const client = useClient({ apiVersion: "2025-01-01" });

  return {
    label: "Auto-fill from ESPN",
    icon: DownloadIcon,
    onHandle: async () => {
      try {
        const doc = (props.draft ?? props.published ?? {}) as {
          short?: string;
          name?: string;
        };
        const guess = doc.short || doc.name || "";
        const q = window.prompt(
          'Auto-fill a college from ESPN.\n\nEnter the team name (e.g. "Oregon Ducks"):',
          guess,
        );
        if (!q || !q.trim()) return props.onComplete();

        if (!SECRET) {
          window.alert(
            "Auto-fill isn’t configured: set SANITY_STUDIO_PREVIEW_SECRET (matching the site’s PREVIEW_SECRET) and redeploy the Studio.",
          );
          return props.onComplete();
        }

        const res = await fetch(
          `${ORIGIN}/api/seed-college?q=${encodeURIComponent(q.trim())}&secret=${encodeURIComponent(SECRET)}`,
        );
        const body = await res.json();

        if (body.candidates) {
          window.alert(
            `Multiple ESPN matches — re-run and type the exact name:\n\n• ${body.candidates.join("\n• ")}`,
          );
          return props.onComplete();
        }
        if (!res.ok || body.error) {
          window.alert(body.message || `No match for “${q}”.`);
          return props.onComplete();
        }

        // Upload the logo preview under the editor's session (optional).
        let logo: unknown;
        if (body.logo?.base64) {
          try {
            const bytes = Uint8Array.from(atob(body.logo.base64), (c) =>
              c.charCodeAt(0),
            );
            const blob = new Blob([bytes], {
              type: body.logo.contentType || "image/png",
            });
            const asset = await client.assets.upload("image", blob, {
              filename: body.logo.filename || "logo",
              contentType: body.logo.contentType,
            });
            logo = {
              _type: "image",
              asset: { _type: "reference", _ref: asset._id },
            };
          } catch {
            /* logo is optional — carry on with the text fields */
          }
        }

        const f = body.fields;
        const set: Record<string, unknown> = {
          name: f.name,
          short: f.short,
          slug: { _type: "slug", current: f.slug },
          mascot: f.mascot,
          fund: f.fund,
          ...(f.city ? { city: f.city } : {}),
          ...(f.state ? { state: f.state } : {}),
          theme: f.theme,
          ...(logo ? { logo } : {}),
        };

        // setIfMissing = prefill blanks only; never overwrite what's typed.
        const draftId = `drafts.${props.id}`;
        await client
          .transaction()
          .createIfNotExists({ _id: draftId, _type: "school" })
          .patch(draftId, (p) => p.setIfMissing(set))
          .commit({ visibility: "async" });

        window.alert(
          "Prefilled from ESPN ✓\n\n⚠ Colors are approximate and the logo is an UNVERIFIED preview. Set the dark “ink” color, verify colors against the official brand, and replace the logo with the partner-approved file before publishing.",
        );
        props.onComplete();
      } catch (err) {
        window.alert(`Auto-fill failed: ${err instanceof Error ? err.message : String(err)}`);
        props.onComplete();
      }
    },
  };
};
