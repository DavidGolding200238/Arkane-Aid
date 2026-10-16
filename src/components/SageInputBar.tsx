import { StyleSheet, TextInput, type StyleProp, type ViewStyle } from "react-native";
import CircleButton from "./CircleButton";
import ParchmentPanel from "./ParchmentPanel";
import { SendArrowIcon } from "./icons";
import type { SagePersona } from "../lib/sage";
import { colors, fonts, useScale } from "../theme";

type Props = {
  persona: SagePersona;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  busy?: boolean;
  onFocus?: () => void;
  style?: StyleProp<ViewStyle>;
};

const LINE = 22; // design line height
const MAX_LINES = 5;

// The square torn-parchment typing box (the Ledger panel art lightened to cream, so it stands
// out from the page) with the
// round red send arrow tucked into its bottom-right corner. The text grows line by line up
// to five lines, then scrolls inside. The send circle always shows in full colour but only sends when there is text.
export default function SageInputBar({ persona, value, onChangeText, onSend, busy, onFocus, style }: Props) {
  const { s, fs } = useScale();
  const sage = persona === "sage";
  const send = s(38);
  const lineH = fs(LINE);
  const disabled = value.trim().length === 0 || !!busy;

  return (
    <ParchmentPanel
      variant="input"
      style={style}
      contentStyle={[styles.row, { paddingLeft: s(18), paddingRight: s(12), paddingTop: s(12), paddingBottom: s(12), gap: s(10) }]}
    >
      <TextInput
        style={[styles.input, { fontSize: fs(16), lineHeight: lineH, minHeight: lineH * 2, maxHeight: lineH * MAX_LINES }]}
        multiline
        placeholder={sage ? "Ask a ruling..." : "Note for the Codex..."}
        placeholderTextColor={colors.muted}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        accessibilityLabel={sage ? "Question for the Sage" : "Note for the Scribe"}
      />
      {/* Always full colour, exactly like the other red circle buttons; it just doesn't send
          while the box is empty or a reply is on its way. */}
      <CircleButton
        size={send}
        onPress={onSend}
        disabled={disabled}
        accessibilityLabel={sage ? "Ask the Sage" : "Send to the Scribe"}
      >
        <SendArrowIcon circleSize={send} />
      </CircleButton>
    </ParchmentPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  input: { flex: 1, fontFamily: fonts.body, color: colors.ink, textAlignVertical: "top", padding: 0 },
});
