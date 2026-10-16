import { StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
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

// The square torn-parchment typing box (Ledger panel art, as in the pass 3 field) with the
// round red send arrow tucked into its bottom-right corner. The text grows line by line up
// to five lines, then scrolls inside. Send is dimmed until there is something to send.
export default function SageInputBar({ persona, value, onChangeText, onSend, busy, onFocus, style }: Props) {
  const { s, fs } = useScale();
  const sage = persona === "sage";
  const send = s(38);
  const lineH = fs(LINE);
  const disabled = value.trim().length === 0 || !!busy;

  return (
    <ParchmentPanel
      variant="ledger"
      style={style}
      contentStyle={[styles.row, { paddingLeft: s(18), paddingRight: s(12), paddingTop: s(12), paddingBottom: s(12), gap: s(10) }]}
    >
      {/* Cream wash over the paper so the box reads lighter than the page behind it. It stops
          just inside the torn edge, so the edge and a hint of texture still show. */}
      <View pointerEvents="none" style={[styles.wash, { top: s(5), left: s(5), right: s(5), bottom: s(5), borderRadius: s(3) }]} />
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
      <View style={disabled ? styles.dim : null}>
        <CircleButton
          size={send}
          onPress={onSend}
          disabled={disabled}
          accessibilityLabel={sage ? "Ask the Sage" : "Send to the Scribe"}
        >
          <SendArrowIcon circleSize={send} />
        </CircleButton>
      </View>
    </ParchmentPanel>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-end" },
  // #FFF6E2 at 60%: lifts the Ledger paper to the light #ffebc8 family.
  wash: { position: "absolute", backgroundColor: "rgba(255,246,226,0.6)" },
  input: { flex: 1, fontFamily: fonts.body, color: colors.ink, textAlignVertical: "top", padding: 0 },
  dim: { opacity: 0.45 },
});
