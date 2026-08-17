import { useCallback, useState } from "react";
import { Box, Button, Card, Code, Heading, Stack, Text } from "@sanity/ui";
import { RocketIcon } from "@sanity/icons";

// "Deploy production" Studio tool — the plumbing, not the decision.
//
// WHAT GOES LIVE is per-school and set on the school itself ("Approve for
// production", see components/ProductionStatusInput.tsx): production serves each
// live school's approved snapshot. This button only asks Vercel to rebuild, so
// it's needed when something OUTSIDE a school changed — site settings, legal
// pages, the resource library — since those have no per-document approve step.
//
// Approving a school already fires this hook, so in the normal flow nobody has
// to come here at all. See docs/DECISIONS.md.
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
        <Heading size={2}>Deploy production</Heading>
        <Card padding={4} radius={3} shadow={1}>
          <Stack space={4}>
            <Text size={2}>
              <Code>staging.xtrapoint.com</Code> rebuilds automatically every
              time you publish. <Code>xtrapoint.com</Code> (production) only
              updates when someone asks it to.
            </Text>
            <Card padding={3} radius={2} tone="primary">
              <Text size={1}>
                <strong>Schools don't need this button.</strong> Open the school
                and use <strong>Approve for production</strong> on its Publishing
                tab — that's what decides whether a school is live and freezes the
                content production serves. It rebuilds for you.
              </Text>
            </Card>
            <Text size={1} muted>
              Use this for changes that aren't tied to one school — site settings,
              legal pages, the resource library — which have no approve step of
              their own. It rebuilds production from the current published content
              for those, and from each live school's approved snapshot for schools.
            </Text>
            <Text size={1} muted>
              This only updates <strong>content</strong>. If something the dev team
              just built isn't showing up after deploying, that's a separate code
              deploy, not something this button controls.
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
                text={status === "loading" ? "Deploying…" : "Deploy production now"}
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
  title: "Deploy production",
  icon: RocketIcon,
  component: PromoteTool,
};
