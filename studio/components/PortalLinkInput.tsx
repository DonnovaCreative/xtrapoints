import { useState } from "react";
import { set, unset, type StringInputProps, useFormValue } from "sanity";
import { Button, Flex, Stack, Text, TextInput } from "@sanity/ui";

// Input for the school's private Marketing Portal link (see the `portalToken`
// field on the school schema). The token IS the URL — /portal/<token> — so this
// control does three things and nothing else:
//   • Generate — mint a fresh 128-bit token (also how you ROTATE/revoke: the old
//     link stops working the moment the new one is published).
//   • Copy link — put the full URL on the clipboard to paste into an email.
//   • Revoke — clear the token entirely, killing the link with no replacement.
//
// The field is deliberately not hand-typable: a short or guessable token is the
// one way this gate fails, so the only way to set it is the generator.
//
// Origin config (Studio env, prefixed SANITY_STUDIO_ so Vite exposes it) —
// reuses the same var the preview actions use, since the portal is served from
// the same site.
const PORTAL_ORIGIN =
  import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";

/** 16 random bytes → 32 hex chars. Must match PORTAL_TOKEN_PATTERN on the site. */
function mintToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function PortalLinkInput(props: StringInputProps) {
  const { value, onChange, elementProps } = props;
  const enabled = useFormValue(["portalEnabled"]) as boolean | undefined;
  const [copied, setCopied] = useState(false);

  const url = value ? `${PORTAL_ORIGIN}/portal/${value}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("Copy the portal link:", url);
    }
  };

  return (
    <Stack space={3}>
      <Flex gap={2} align="center">
        <TextInput
          {...elementProps}
          value={url}
          readOnly
          placeholder="No link yet — click Generate"
          style={{ flex: 1 }}
        />
        <Button
          mode="ghost"
          text={value ? "Regenerate" : "Generate"}
          tone={value ? "caution" : "default"}
          title={
            value
              ? "Mint a new link. The current link stops working once you publish."
              : "Create this school's private portal link"
          }
          onClick={() => {
            if (
              value &&
              !window.confirm(
                "Generate a new link?\n\nThe current link will stop working as soon as you publish, and anyone using it will need the new one.",
              )
            ) {
              return;
            }
            onChange(set(mintToken()));
          }}
        />
        <Button
          mode="ghost"
          text={copied ? "Copied" : "Copy link"}
          disabled={!value}
          tone={copied ? "positive" : "default"}
          onClick={copy}
        />
        {value && (
          <Button
            mode="bleed"
            tone="critical"
            text="Revoke"
            title="Clear the link entirely — no replacement is generated"
            onClick={() => {
              if (
                window.confirm(
                  "Revoke this portal link?\n\nThe school will lose access once you publish. Generate a new link to restore it.",
                )
              ) {
                onChange(unset());
              }
            }}
          />
        )}
      </Flex>

      {value && enabled !== true && (
        <Text size={1} muted>
          This link exists but “Portal access” is off, so it shows a deactivated
          notice. Turn access on to make it live.
        </Text>
      )}

      <Text size={1} muted>
        Changes take effect when you publish this school.
      </Text>
    </Stack>
  );
}
