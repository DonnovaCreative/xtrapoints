import { set, unset, type StringInputProps, useFormValue } from "sanity";
import { Flex, TextInput, Button } from "@sanity/ui";

// Fund field with a "Generate" button: fills "<Mascot> Athletics Fund" from the
// mascot field (like the slug's Generate). Editors can still type/override.
export function FundInput(props: StringInputProps) {
  const { value, onChange, elementProps } = props;
  const mascot = useFormValue(["mascot"]) as string | undefined;

  return (
    <Flex gap={2} align="center">
      <TextInput
        {...elementProps}
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.currentTarget.value ? set(e.currentTarget.value) : unset())
        }
        style={{ flex: 1 }}
      />
      <Button
        mode="ghost"
        text="Generate"
        disabled={!mascot}
        title={mascot ? `Set to "${mascot} Athletics Fund"` : "Set a mascot first"}
        onClick={() => mascot && onChange(set(`${mascot} Athletics Fund`))}
      />
    </Flex>
  );
}
