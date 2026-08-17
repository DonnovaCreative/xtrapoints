import { useCallback, useMemo, useState } from "react";
import { useClient, useFormValue, type StringInputProps } from "sanity";
import { Badge, Button, Card, Flex, Stack, Text } from "@sanity/ui";

// Per-school promotion to production.
//
// Publishing puts a school on STAGING. This is the separate, deliberate step
// that puts it on xtrapoint.com — and, crucially, it FREEZES the content:
// `approvedVersion` holds the exact snapshot production serves. That's what
// makes editing a live school safe. Their edits show on staging for review while
// production keeps serving the approved version, until someone approves again.
//
// The snapshot itself comes from the site (/api/school-snapshot) so the GROQ
// projection has one definition; the write happens here, under the editor's own
// session, so approvals appear in the document's history with a name on them.
//
// Config (Studio env, SANITY_STUDIO_ prefix so Vite exposes it):
//   SANITY_STUDIO_PREVIEW_ORIGIN         — site to fetch the snapshot from
//   SANITY_STUDIO_PREVIEW_SECRET         — shared secret that endpoint checks
//   SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL — fired after approving, to rebuild
const ORIGIN = import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";
const SECRET = import.meta.env.SANITY_STUDIO_PREVIEW_SECRET ?? "";
const HOOK_URL = import.meta.env.SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL ?? "";

export function ProductionStatusInput(props: StringInputProps) {
  const client = useClient({ apiVersion: "2024-01-01" });
  const docId = (useFormValue(["_id"]) as string | undefined)?.replace(/^drafts\./, "");
  const slug = useFormValue(["slug", "current"]) as string | undefined;
  const status = props.value;
  const approvedAt = useFormValue(["approvedAt"]) as string | undefined;
  const updatedAt = useFormValue(["_updatedAt"]) as string | undefined;

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Live, but edited since it was approved — production is serving something
  // older than what's on staging. The one state worth calling out unprompted.
  const stale = useMemo(() => {
    if (status !== "live" || !approvedAt || !updatedAt) return false;
    return new Date(updatedAt).getTime() > new Date(approvedAt).getTime() + 2000;
  }, [status, approvedAt, updatedAt]);

  const approve = useCallback(async () => {
    if (!slug || !docId) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(
        `${ORIGIN}/api/school-snapshot?school=${encodeURIComponent(slug)}&secret=${encodeURIComponent(SECRET)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "not_published") {
          throw new Error("Publish the school first — there's no published content to approve.");
        }
        throw new Error(data.message ?? data.error ?? "Couldn't build the snapshot");
      }

      await client
        .patch(docId)
        .set({
          approvedVersion: data.snapshot,
          approvedAt: new Date().toISOString(),
          productionStatus: "live",
        })
        .commit();

      if (HOOK_URL) await fetch(HOOK_URL, { method: "POST" });

      setNote(
        HOOK_URL
          ? "Approved. Production is rebuilding — live in a minute or two."
          : "Approved. No deploy hook configured, so trigger a production build yourself.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, docId, slug]);

  const takeDown = useCallback(async () => {
    if (!docId) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      // Keep the snapshot: putting the school back up shouldn't need re-approval
      // of content nobody changed.
      await client.patch(docId).set({ productionStatus: "draft" }).commit();
      if (HOOK_URL) await fetch(HOOK_URL, { method: "POST" });
      setNote("Taken off production. Still on staging.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, docId]);

  return (
    <Stack space={4}>
      {props.renderDefault(props)}

      <Card padding={4} radius={2} tone="transparent" border>
        <Stack space={4}>
          <Flex align="center" gap={2}>
            <Text size={1} weight="semibold" style={{ flex: 1 }}>
              On xtrapoint.com
            </Text>
            {status === "live" ? (
              <Badge tone={stale ? "caution" : "positive"} fontSize={0}>
                {stale ? "Live — changes not approved" : "Live"}
              </Badge>
            ) : (
              <Badge tone="default" fontSize={0}>
                Not live
              </Badge>
            )}
          </Flex>

          {stale && (
            <Card padding={3} radius={2} tone="caution">
              <Text size={1}>
                This school has been edited since it was approved. xtrapoint.com is
                still showing the approved version — approve again to publish the
                changes.
              </Text>
            </Card>
          )}

          <Text size={1} muted>
            {status === "live"
              ? "Approving again freezes the current published content as what production serves."
              : "Approving puts this school on xtrapoint.com, frozen at its current published content. Later edits stay on staging until you approve again."}
          </Text>

          {!slug && (
            <Card padding={3} radius={2} tone="caution">
              <Text size={1}>Give the school a slug first.</Text>
            </Card>
          )}

          <Flex gap={2}>
            <Button
              text={status === "live" ? "Approve changes" : "Approve for production"}
              tone="primary"
              disabled={busy || !slug || !SECRET}
              onClick={() => void approve()}
            />
            {status === "live" && (
              <Button
                text="Take off production"
                mode="ghost"
                tone="critical"
                disabled={busy}
                onClick={() => void takeDown()}
              />
            )}
          </Flex>

          {note && (
            <Card padding={3} radius={2} tone="positive">
              <Text size={1}>{note}</Text>
            </Card>
          )}
          {error && (
            <Card padding={3} radius={2} tone="critical">
              <Text size={1}>{error}</Text>
            </Card>
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

export default ProductionStatusInput;
