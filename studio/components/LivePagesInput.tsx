import { useCallback, useState } from "react";
import { useFormValue, type ObjectInputProps } from "sanity";
import { Badge, Button, Card, Flex, Stack, Text } from "@sanity/ui";

// Which of a school's two public pages are on xtrapoint.com.
//
// A SECOND axis under productionStatus, not a replacement for it: "Approve for
// production" decides whether the school is live at all and freezes the content
// production serves; this decides which of its pages that covers. A school
// mid-onboarding can launch its ambassador page while the donor page waits — the
// case this was built for.
//
// Deliberately NOT part of the approved snapshot (same reasoning as the takedown
// button next door): pulling a page down must not require approving whatever
// content edits happen to be in flight. It's read live off the published
// document, so it takes effect on the next production build — hence the button.
//
// Config (Studio env, SANITY_STUDIO_ prefix so Vite exposes it):
//   SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL — fired to rebuild production
const HOOK_URL = import.meta.env.SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL ?? "";

interface LivePages {
  donor?: boolean;
  ambassador?: boolean;
}

// Unset means live — every school that existed before this field did had both
// pages, and they must stay up.
const on = (v?: boolean) => v !== false;

export function LivePagesInput(props: ObjectInputProps) {
  const value = (props.value ?? {}) as LivePages;
  const status = useFormValue(["productionStatus"]) as string | undefined;
  const slug = useFormValue(["slug", "current"]) as string | undefined;

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rebuild = useCallback(async () => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(HOOK_URL, { method: "POST" });
      if (!res.ok) throw new Error(`Vercel responded ${res.status}`);
      setNote("Production is rebuilding — the change is live in a minute or two.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, []);

  const rows: { label: string; path: string; live: boolean }[] = [
    { label: "Donor page", path: `/schools/${slug ?? "…"}`, live: on(value.donor) },
    {
      label: "Ambassador page",
      path: `/schools/${slug ?? "…"}/ambassadors`,
      live: on(value.ambassador),
    },
  ];

  return (
    <Stack space={4}>
      {props.renderDefault(props)}

      <Card padding={4} radius={2} tone="transparent" border>
        <Stack space={4}>
          {status !== "live" ? (
            <Text size={1} muted>
              This school isn't on xtrapoint.com yet, so nothing here is public.
              Approve it for production above first — these switches then decide
              which of its pages that covers.
            </Text>
          ) : (
            <Stack space={3}>
              {rows.map((row) => (
                <Flex key={row.label} align="center" gap={2}>
                  <Text size={1} weight="semibold" style={{ flex: 1 }}>
                    {row.label}
                    <span style={{ opacity: 0.5, fontWeight: 400 }}> · {row.path}</span>
                  </Text>
                  <Badge tone={row.live ? "positive" : "default"} fontSize={0}>
                    {row.live ? "Live" : "Off"}
                  </Badge>
                </Flex>
              ))}
            </Stack>
          )}

          <Text size={1} muted>
            A page switched off doesn't exist on xtrapoint.com — its URL 404s and
            the other page stops linking to it. Both pages stay on staging either
            way, so you can keep working on the one that isn't public yet.
          </Text>

          {status === "live" && (
            <Stack space={3}>
              <Text size={1} muted>
                Publish the school first — then this takes effect on the next
                production build.
              </Text>
              <Flex>
                <Button
                  text="Update xtrapoint.com"
                  tone="primary"
                  mode="ghost"
                  disabled={busy || !HOOK_URL}
                  onClick={() => void rebuild()}
                />
              </Flex>
            </Stack>
          )}

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

export default LivePagesInput;
