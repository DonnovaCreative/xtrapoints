import { set, type NumberInputProps } from "sanity";
import { Box, Flex, Text } from "@sanity/ui";

// Range slider (24–120px) with a live px readout, for the custom header-logo
// height. Shown only when Header logo size = "Custom" (see schemas/school.ts).
const MIN = 24;
const MAX = 120;

export function LogoHeightInput(props: NumberInputProps) {
  const { value, onChange } = props;
  const v = typeof value === "number" ? value : 40;

  return (
    <Flex align="center" gap={3}>
      <input
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={v}
        onChange={(e) => onChange(set(Number(e.currentTarget.value)))}
        aria-label="Logo height in pixels"
        style={{ flex: 1, cursor: "pointer" }}
      />
      <Box style={{ minWidth: 52, textAlign: "right" }}>
        <Text size={1} weight="semibold">
          {v}px
        </Text>
      </Box>
    </Flex>
  );
}
