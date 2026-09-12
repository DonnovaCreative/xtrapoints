import { useFormValue, type BooleanInputProps } from "sanity";
import { Card, Stack, Text } from "@sanity/ui";

const ORIGIN = import.meta.env.SANITY_STUDIO_PREVIEW_ORIGIN ?? "https://www.xtrapoint.com";

/** Account administration requires the application's authenticated staff session.
 * No invitation, membership or preview credentials are exposed by this input. */
export function PortalAccessInput(props: BooleanInputProps) {
  const documentId = useFormValue(["_id"]) as string | undefined;
  const partnerId = documentId?.replace(/^drafts\./, "");
  const href = partnerId ? `${ORIGIN}/admin/schools/${encodeURIComponent(partnerId)}` : `${ORIGIN}/admin/schools`;
  return <Stack space={4}>
    <Card padding={4} radius={2} tone="transparent" border>
      <Stack space={3}>
        <Text size={1} weight="semibold">Manage this school's workspace</Text>
        <Text size={1}>Prepare the partner workspace, control access and invite its team from School administration. Sign in with your XtraPoint staff administrator account.</Text>
        <Text size={1} muted>Current access: {props.value ? "Enabled" : "Disabled"}. The school can prepare its pages before they are public.</Text>
        <a href={href} target="_blank" rel="noopener noreferrer" style={{fontWeight:600}}>Open School administration →</a>
      </Stack>
    </Card>
  </Stack>;
}
export default PortalAccessInput;
