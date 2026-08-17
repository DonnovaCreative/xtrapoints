import { useCallback, useEffect, useState } from "react";
import { useFormValue, type BooleanInputProps } from "sanity";
import { Badge, Button, Card, Flex, Spinner, Stack, Text, TextInput } from "@sanity/ui";

// "Who can open this portal" — the whole account setup for a school, in the
// Studio, so onboarding never needs a developer or a terminal.
//
// Rendered under the Portal access toggle. It talks to /api/portal-access on the
// site, which owns the Clerk secret key (this bundle is public JS, so it can't).
// The organization is created by the first invite, so there is no separate
// "create the org" step to remember or get wrong.
//
// Config (Studio env, SANITY_STUDIO_ prefix so Vite exposes it):
//   SANITY_STUDIO_PREVIEW_ORIGIN — the site to call
//   SANITY_STUDIO_PREVIEW_SECRET — shared secret the endpoint checks
const ORIGIN = import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";
const SECRET = import.meta.env.SANITY_STUDIO_PREVIEW_SECRET ?? "";

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
}
interface Invitation {
  id: string;
  email: string;
}
interface AccessState {
  org: { id: string; name: string } | null;
  members: Member[];
  invitations: Invitation[];
}

export function PortalAccessInput(props: BooleanInputProps) {
  const slug = useFormValue(["slug", "current"]) as string | undefined;
  const published = useFormValue(["_id"]) as string | undefined;

  const [state, setState] = useState<AccessState | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug || !SECRET) return;
    setError(null);
    try {
      const res = await fetch(
        `${ORIGIN}/api/portal-access?school=${encodeURIComponent(slug)}&secret=${encodeURIComponent(SECRET)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Request failed");
      setState(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>, successNote: string) => {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`${ORIGIN}/api/portal-access`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, school: slug, secret: SECRET }),
      });
      const data = await res.json();
      if (!res.ok) {
        // The failures worth explaining rather than dumping raw.
        if (data.error === "school_not_published") {
          throw new Error("Publish the school first — its pages need to exist before you invite anyone.");
        }
        if (data.error === "already_invited") {
          throw new Error("That address has already been invited.");
        }
        throw new Error(data.message ?? data.error ?? "Request failed");
      }
      setState(data);
      setNote(successNote);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const invite = () => {
    const value = email.trim();
    if (!value) return;
    void post({ email: value }, `Invitation sent to ${value}.`).then(() => setEmail(""));
  };

  return (
    <Stack space={4}>
      {/* The Portal access toggle itself. */}
      {props.renderDefault(props)}

      <Card padding={4} radius={2} tone="transparent" border>
        <Stack space={4}>
          <Stack space={2}>
            <Text size={1} weight="semibold">
              Who can open this portal
            </Text>
            <Text size={1} muted>
              Invite someone and they'll get an email that creates their account and
              drops them straight into this school's portal. No link to copy, and
              nothing for them to set up.
            </Text>
          </Stack>

          {!SECRET && (
            <Card padding={3} radius={2} tone="caution">
              <Text size={1}>
                SANITY_STUDIO_PREVIEW_SECRET isn't set in this Studio, so access can't
                be managed here.
              </Text>
            </Card>
          )}

          {!slug && (
            <Card padding={3} radius={2} tone="caution">
              <Text size={1}>Give the school a slug first.</Text>
            </Card>
          )}

          {published?.startsWith("drafts.") && (
            <Card padding={3} radius={2} tone="caution">
              <Text size={1}>
                This school has unpublished changes. Invitations work off the published
                document.
              </Text>
            </Card>
          )}

          {/* Current access */}
          {state === null && SECRET && slug ? (
            <Flex align="center" gap={2}>
              <Spinner muted />
              <Text size={1} muted>
                Checking…
              </Text>
            </Flex>
          ) : (
            state && (
              <Stack space={3}>
                {state.members.length === 0 && state.invitations.length === 0 && (
                  <Text size={1} muted>
                    Nobody yet.
                  </Text>
                )}

                {state.members.map((m) => (
                  <Flex key={m.id} align="center" gap={3}>
                    <Stack space={2} flex={1}>
                      <Text size={1} weight="medium">
                        {m.name || m.email}
                      </Text>
                      {m.name && (
                        <Text size={1} muted>
                          {m.email}
                        </Text>
                      )}
                    </Stack>
                    <Badge tone="positive" fontSize={0}>
                      Active
                    </Badge>
                    <Button
                      mode="bleed"
                      tone="critical"
                      fontSize={1}
                      padding={2}
                      text="Remove"
                      disabled={busy}
                      onClick={() =>
                        void post({ removeMember: m.id }, `Removed ${m.email}.`)
                      }
                    />
                  </Flex>
                ))}

                {state.invitations.map((i) => (
                  <Flex key={i.id} align="center" gap={3}>
                    <Text size={1} style={{ flex: 1 }}>
                      {i.email}
                    </Text>
                    <Badge tone="caution" fontSize={0}>
                      Invited
                    </Badge>
                    <Button
                      mode="bleed"
                      tone="critical"
                      fontSize={1}
                      padding={2}
                      text="Cancel"
                      disabled={busy}
                      onClick={() =>
                        void post({ revokeInvitation: i.id }, `Invitation to ${i.email} cancelled.`)
                      }
                    />
                  </Flex>
                ))}
              </Stack>
            )
          )}

          {/* Invite */}
          <Flex gap={2}>
            <TextInput
              flex={1}
              type="email"
              placeholder="name@school.edu"
              value={email}
              disabled={busy || !slug || !SECRET}
              onChange={(e) => setEmail(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  invite();
                }
              }}
            />
            <Button
              text="Send invite"
              tone="primary"
              disabled={busy || !email.trim() || !slug || !SECRET}
              onClick={invite}
            />
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

          <Text size={1} muted>
            Turning Portal access off switches the whole school off — everyone here
            gets a "not active" notice until it's back on.
          </Text>
        </Stack>
      </Card>
    </Stack>
  );
}

export default PortalAccessInput;
