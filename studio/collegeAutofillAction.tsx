import { useCallback, useEffect, useRef, useState } from "react";
import { useClient, type DocumentActionComponent } from "sanity";
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Spinner,
  Stack,
  Text,
  TextInput,
} from "@sanity/ui";
import { DownloadIcon, SearchIcon } from "@sanity/icons";

// "Auto-fill from ESPN" document action for the `school` type — the browser
// equivalent of the terminal `seed:college` flow. Opens a dialog with a search
// box + clickable results (no retyping): pick a college, review the preview, then
// "Fill in this school" PREFILLS the open draft (setIfMissing, so it never
// clobbers typed values) and uploads the logo under the editor's own session.
//
// Config (Studio env, same vars as the preview button):
//   SANITY_STUDIO_PREVIEW_ORIGIN — where /api/seed-college is deployed.
//   SANITY_STUDIO_PREVIEW_SECRET — must match the site's PREVIEW_SECRET.
const ORIGIN =
  import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";
const SECRET = import.meta.env.SANITY_STUDIO_PREVIEW_SECRET ?? "";

interface Fields {
  name: string;
  short: string;
  slug: string;
  mascot: string;
  fund: string;
  city?: string;
  state?: string;
  theme: { primary: string; secondary?: string; ink: string };
}
interface Logo {
  base64: string;
  contentType: string;
  filename: string;
}
interface Candidate {
  // Optional only for compatibility with the previous API during deployment.
  id?: string;
  displayName: string;
}
type View =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "candidates"; candidates: Candidate[] }
  | { status: "match"; match: string; fields: Fields; logo: Logo | null };

const Swatch = ({ hex }: { hex?: string }) =>
  hex ? (
    <Box
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        background: hex,
        border: "1px solid var(--card-border-color, #ccc)",
      }}
    />
  ) : null;

export const collegeAutofillAction: DocumentActionComponent = (props) => {
  const client = useClient({ apiVersion: "2025-01-01" });
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [resultFilter, setResultFilter] = useState("");
  const [view, setView] = useState<View>({ status: "idle" });
  const [applying, setApplying] = useState(false);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  const close = useCallback(() => {
    request.current?.abort();
    setOpen(false);
    setApplying(false);
    props.onComplete();
  }, [props]);

  const search = useCallback(async (raw: string, teamId?: string) => {
    const q = raw.trim();
    if (!q) return;
    if (!SECRET) {
      setView({
        status: "error",
        message:
          "Auto-fill isn’t configured: set SANITY_STUDIO_PREVIEW_SECRET (matching the site’s PREVIEW_SECRET) and redeploy the Studio.",
      });
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setResultFilter("");
    setView({ status: "loading" });
    try {
      const params = new URLSearchParams({ q, secret: SECRET });
      if (teamId) params.set("teamId", teamId);
      const res = await fetch(
        `${ORIGIN}/api/seed-college?${params}`,
        { signal: controller.signal },
      );
      const body = await res.json();
      if (controller.signal.aborted) return;
      if (!res.ok || body.error) {
        setView({ status: "error", message: body.message || `No match for “${q}”.` });
      } else if (body.teams || body.candidates) {
        setView({
          status: "candidates",
          candidates: body.teams ?? body.candidates.map((displayName: string) => ({ displayName })),
        });
      } else {
        setView({
          status: "match",
          match: body.match,
          fields: body.fields,
          logo: body.logo ?? null,
        });
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setView({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const apply = useCallback(async () => {
    if (view.status !== "match") return;
    setApplying(true);
    try {
      let logo: unknown;
      if (view.logo?.base64) {
        try {
          const bytes = Uint8Array.from(atob(view.logo.base64), (c) => c.charCodeAt(0));
          const blob = new Blob([bytes], { type: view.logo.contentType || "image/png" });
          const asset = await client.assets.upload("image", blob, {
            filename: view.logo.filename || "logo",
            contentType: view.logo.contentType,
          });
          logo = { _type: "image", asset: { _type: "reference", _ref: asset._id } };
        } catch {
          /* logo optional */
        }
      }
      const f = view.fields;
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
      const draftId = `drafts.${props.id}`;
      await client
        .transaction()
        .createIfNotExists({ _id: draftId, _type: "school" })
        .patch(draftId, (p) => p.setIfMissing(set))
        .commit({ visibility: "async" });
      close();
    } catch (err) {
      setView({
        status: "error",
        message: `Couldn’t apply: ${err instanceof Error ? err.message : String(err)}`,
      });
      setApplying(false);
    }
  }, [view, client, props.id, close]);

  const candidates = view.status === "candidates"
    ? view.candidates.filter((team) =>
        team.displayName.toLowerCase().includes(resultFilter.trim().toLowerCase()),
      )
    : [];

  return {
    label: "Auto-fill from ESPN",
    icon: DownloadIcon,
    onHandle: () => {
      request.current?.abort();
      const doc = (props.draft ?? props.published ?? {}) as {
        short?: string;
        name?: string;
      };
      setQuery(doc.short || doc.name || "");
      setResultFilter("");
      setView({ status: "idle" });
      setOpen(true);
    },
    dialog: open && {
      type: "dialog",
      id: "college-autofill",
      header: "Auto-fill a college from ESPN",
      width: "medium",
      onClose: applying ? () => {} : close,
      content: (
        <Stack space={4} padding={1}>
          <Stack space={2}>
            <Text size={1} muted>
              Search by team name (e.g. “Oregon Ducks”). Colleges only. Colors are
              approximate and the logo is an unverified preview.
            </Text>
            <Flex gap={2}>
              <Box flex={1}>
                <TextInput
                  aria-label="College or team name"
                  value={query}
                  disabled={applying}
                  onChange={(e) => {
                    request.current?.abort();
                    setQuery(e.currentTarget.value);
                    setView({ status: "idle" });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (!applying && view.status !== "loading") search(query);
                    }
                  }}
                  placeholder="Oregon Ducks"
                  autoFocus
                />
              </Box>
              <Button
                icon={SearchIcon}
                text="Search"
                tone="primary"
                disabled={!query.trim() || view.status === "loading" || applying}
                onClick={() => search(query)}
              />
            </Flex>
          </Stack>

          {view.status === "loading" && (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1} muted>
                Searching ESPN…
              </Text>
            </Flex>
          )}

          {view.status === "error" && (
            <Card padding={3} radius={2} tone="critical">
              <Text size={1}>{view.message}</Text>
            </Card>
          )}

          {view.status === "candidates" && (
            <Stack space={2}>
              <Text size={1} weight="semibold">
                {view.candidates.length} matches — choose a school:
              </Text>
              <TextInput
                aria-label="Filter matching schools"
                placeholder="Filter these results…"
                value={resultFilter}
                onChange={(e) => setResultFilter(e.currentTarget.value)}
              />
              <Box style={{ maxHeight: 280, overflowY: "auto" }}>
                <Stack space={2}>
                  {candidates.map((team) => (
                    <Button
                      key={team.id ?? team.displayName}
                      mode="ghost"
                      justify="flex-start"
                      text={team.displayName}
                      onClick={() => {
                        setQuery(team.displayName);
                        search(team.displayName, team.id);
                      }}
                    />
                  ))}
                  {candidates.length === 0 && (
                    <Text size={1} muted>
                      No schools match this filter. Clear it to see all results.
                    </Text>
                  )}
                </Stack>
              </Box>
            </Stack>
          )}

          {view.status === "match" && (
            <Card padding={3} radius={2} shadow={1}>
              <Flex gap={3} align="flex-start">
                {view.logo && (
                  <Box
                    style={{
                      width: 56,
                      height: 56,
                      flex: "none",
                      borderRadius: 6,
                      background: "#f2f3f5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`data:${view.logo.contentType};base64,${view.logo.base64}`}
                      alt=""
                      style={{ maxWidth: "100%", maxHeight: "100%" }}
                    />
                  </Box>
                )}
                <Stack space={3} flex={1}>
                  <Stack space={2}>
                    <Text size={2} weight="semibold">
                      {view.fields.name}
                    </Text>
                    <Text size={1} muted>
                      {view.fields.mascot}
                      {view.fields.city
                        ? ` · ${view.fields.city}, ${view.fields.state}`
                        : ""}
                    </Text>
                  </Stack>
                  <Grid columns={2} gap={2}>
                    <Flex gap={2} align="center">
                      <Swatch hex={view.fields.theme.primary} />
                      <Text size={0} muted>
                        Primary {view.fields.theme.primary}
                      </Text>
                    </Flex>
                    {view.fields.theme.secondary && (
                      <Flex gap={2} align="center">
                        <Swatch hex={view.fields.theme.secondary} />
                        <Text size={0} muted>
                          Secondary {view.fields.theme.secondary}
                        </Text>
                      </Flex>
                    )}
                  </Grid>
                  <Text size={0} muted>
                    Fills only blank fields, so anything you’ve typed is kept.
                    You’ll still set the dark “ink” color and replace the logo with
                    the approved file before publishing.
                  </Text>
                </Stack>
              </Flex>
            </Card>
          )}

          <Flex gap={2} justify="flex-end">
            <Button mode="ghost" text="Cancel" onClick={close} disabled={applying} />
            {view.status === "match" && (
              <Button
                text={applying ? "Filling…" : "Fill in this school"}
                tone="primary"
                icon={DownloadIcon}
                disabled={applying}
                onClick={apply}
              />
            )}
          </Flex>
        </Stack>
      ),
    },
  };
};
