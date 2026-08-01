import { useCallback, useState } from "react";
import { Box, Button, Card, Code, Heading, Stack, Text } from "@sanity/ui";
import { RocketIcon } from "@sanity/icons";

// "Promote to production" Studio tool — staging auto-rebuilds on every publish
// (the "Rebuild staging" Sanity webhook), but production does NOT: that webhook
// was removed so a publish can't blast straight to xtrapoint.com. This tool is
// the deliberate, one-click replacement — it POSTs directly to the production
// Vercel Deploy Hook (bypassing Sanity entirely) once an editor has reviewed on
// staging and wants to go live. See docs/DECISIONS.md.
//
// Config (Studio env, prefixed SANITY_STUDIO_ so Vite exposes them):
//   SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL — the Vercel Deploy Hook for the
//   `main` branch/production deploy (from Vercel → Project → Settings → Git →
//   Deploy Hooks). Same obscurity-level posture as the preview secret: it's
//   bundled into the (publicly served) Studio JS, so treat it as low-sensitivity
//   — anyone with it can trigger a production rebuild, but not read/write content.
const HOOK_URL = import.meta.env.SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL ?? "";

type Status = "idle" | "loading" | "done" | "error";

function PromoteTool() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const promote = useCallback(async () => {
    if (!HOOK_URL) return;
    setStatus("loading");
    setError(null);
    try {
      const res = await fetch(HOOK_URL, { method: "POST" });
      if (!res.ok) throw new Error(`Vercel responded ${res.status}`);
      setStatus("done");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return (
    <Box padding={4} style={{ maxWidth: 640 }}>
      <Stack space={4}>
        <Heading size={2}>Promote to production</Heading>
        <Card padding={4} radius={3} shadow={1}>
          <Stack space={4}>
            <Text size={2}>
              <Code>staging.xtrapoint.com</Code> rebuilds automatically every
              time you publish. <Code>xtrapoint.com</Code> (production) does
              not — it only updates when you click the button below.
            </Text>
            <Text size={1} muted>
              Review your changes on staging first. When you're ready to make
              them live, click promote — it triggers a production rebuild
              (usually live within a couple of minutes).
            </Text>
            <Text size={1} muted>
              This also removes anything from production that's been{" "}
              <strong>unpublished</strong> or toggled{" "}
              <strong>"Hide from production"</strong> since the last promote —
              promoting rebuilds production from whatever is currently
              published (and not hidden), so it's how removals go live too,
              not just additions.
            </Text>
            <Text size={1} muted>
              This only updates <strong>content</strong> — school info, copy,
              photos, etc. If something the dev team just built isn't showing
              up here after promoting, that's a separate code deploy they need
              to do first, not something this button controls.
            </Text>

            {!HOOK_URL && (
              <Card padding={3} radius={2} tone="critical">
                <Text size={1}>
                  Not configured — set
                  {" "}
                  <Code>SANITY_STUDIO_PRODUCTION_DEPLOY_HOOK_URL</Code> in
                  studio/.env and redeploy the Studio (
                  <Code>npx sanity deploy</Code>).
                </Text>
              </Card>
            )}

            <Box>
              <Button
                text={status === "loading" ? "Promoting…" : "Promote to production"}
                tone="positive"
                icon={RocketIcon}
                disabled={!HOOK_URL || status === "loading"}
                onClick={promote}
              />
            </Box>

            {status === "done" && (
              <Card padding={3} radius={2} tone="positive">
                <Text size={1}>
                  ✓ Production rebuild triggered. Give it a minute or two.
                </Text>
              </Card>
            )}
            {status === "error" && (
              <Card padding={3} radius={2} tone="critical">
                <Text size={1}>Failed to trigger the deploy: {error}</Text>
              </Card>
            )}
          </Stack>
        </Card>
      </Stack>
    </Box>
  );
}

export const promoteTool = {
  name: "promote-production",
  title: "Promote to production",
  icon: RocketIcon,
  component: PromoteTool,
};
