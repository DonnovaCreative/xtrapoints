import { useCallback } from "react";
import { set, unset, type StringInputProps } from "sanity";
import { Flex, TextInput, Button } from "@sanity/ui";

// Custom color input that stores a plain hex STRING (e.g. "#aaf10a") while
// giving editors a visual swatch/picker, a hex field, and a Clear button.
// Storing a string (vs the color-input plugin's object) is what makes the value
// clearable, editable, and safe to default — see src/data/schools.ts.
const HEX = /^#[0-9a-fA-F]{6}$/;

export function ColorInput(props: StringInputProps) {
  const { value, onChange, elementProps } = props;
  const swatch = value && HEX.test(value) ? value : "#000000";

  const setHex = useCallback(
    (raw: string) => {
      const v = raw.trim().toLowerCase();
      onChange(v ? set(v) : unset());
    },
    [onChange],
  );

  return (
    <Flex gap={2} align="center">
      <input
        type="color"
        value={swatch}
        onChange={(e) => onChange(set(e.currentTarget.value.toLowerCase()))}
        aria-label="Color picker"
        style={{
          width: 42,
          height: 35,
          padding: 0,
          border: "1px solid var(--card-border-color, #ccc)",
          borderRadius: 4,
          background: "none",
          cursor: "pointer",
          flex: "none",
        }}
      />
      <TextInput
        {...elementProps}
        value={value ?? ""}
        onChange={(e) => setHex(e.currentTarget.value)}
        placeholder="#aaf10a"
        style={{ flex: 1 }}
      />
      {value ? (
        <Button
          mode="ghost"
          text="Clear"
          fontSize={1}
          onClick={() => onChange(unset())}
        />
      ) : null}
    </Flex>
  );
}
