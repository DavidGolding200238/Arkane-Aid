import { Image, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from "react-native";
import CircleButton from "./CircleButton";
import { SendArrowIcon } from "./icons";
import type { SagePersona } from "../lib/sage";
import { colors, fonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");

type Props = {
  persona: SagePersona;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  busy?: boolean;
  onFocus?: () => void;
  style?: StyleProp<ViewStyle>;
};

const LINE = 21; // design line height
const MAX_LINES = 5;

// Slim chat-style bar: a rounded strip of parchment with a thin inked edge and a soft
// shadow, a text field that grows with each line (up to five, then it scrolls inside),
// and the textured red send circle built into the right end.
export default function SageInputBar({ persona, value, onChangeText, onSend, busy, onFocus, style }: Props) {
  const { s, fs } = useScale();
  const sage = persona === "sage";
  const send = s(38);
  const pad = s(5);
  const lineH = fs(LINE);
  const empty = value.trim().length === 0;
  const disabled = empty || !!busy;

  return (
    <View style={[styles.bar, { borderRadius: (send + pad * 2) / 2, padding: pad, paddingLeft: s(16) }, style]}>
      {/* Paper texture clipped to the rounded bar. */}
      <View style={[styles.paper, { borderRadius: (send + pad * 2) / 2 }]} pointerEvents="none">
        <Image source={parchment} style={styles.paperImage} resizeMode="cover" />
      </View>
      <TextInput
        style={[
          styles.input,
          {
            fontSize: fs(16),
            lineHeight: lineH,
            minHeight: send,
            maxHeight: lineH * MAX_LINES + s(14),
            paddingTop: (send - lineH) / 2,
            paddingBottom: (send - lineH) / 2,
            marginRight: s(8),
          },
        ]}
        multiline
        placeholder={sage ? "Ask a ruling..." : "Note for the Codex..."}
        placeholderTextColor={colors.placeholder}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        accessibilityLabel={sage ? "Question for the Sage" : "Note for the Scribe"}
      />
      <CircleButton
        size={send}
        onPress={onSend}
        disabled={disabled}
        accessibilityLabel={sage ? "Ask the Sage" : "Send to the Scribe"}
        style={disabled ? styles.dim : null}
      >
        <SendArrowIcon circleSize={send} />
      </CircleButton>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: "rgba(63,56,45,0.55)",
    // Lift off the page: elevation on Android, shadow props on iOS.
    elevation: 5,
    shadowColor: "#2A1C0A",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  paper: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden" },
  paperImage: { width: "100%", height: "100%", opacity: 0.5 },
  input: { flex: 1, fontFamily: fonts.body, color: colors.ink, textAlignVertical: "top", paddingHorizontal: 0 },
  dim: { opacity: 0.45 },
});
