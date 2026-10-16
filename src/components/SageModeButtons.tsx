import { Pressable, StyleSheet, Text, View } from "react-native";
import CircleButton from "./CircleButton";
import MicSvg from "../../assets/images/icons/icon-mic.svg";
import QuillSvg from "../../assets/images/icons/icon-hand-quill.svg";
import type { SagePersona } from "../lib/sage";
import { colors, fonts, useScale } from "../theme";

type Mode = { id: SagePersona; label: string; hint: string; Icon: typeof MicSvg };
const MODES: [Mode, Mode] = [
  { id: "sage", label: "Sage", hint: "Ask the Sage a ruling", Icon: MicSvg },
  { id: "scribe", label: "Scribe", hint: "Have the Scribe note what happened", Icon: QuillSvg },
];

type Props = {
  persona: SagePersona;
  onChange: (next: SagePersona) => void;
  /** Gap between the two buttons in design dp. */
  gap?: number;
};

// Two separate mode buttons: Sage (microphone) on the left, Scribe (quill) on the right.
// The chosen one is the textured red circle used across the app with a cream icon;
// it sits on a soft drop shadow so it lifts off the page. The other is a quiet inked ring on the parchment with a muted icon. One small word under each.
export default function SageModeButtons({ persona, onChange, gap = 96 }: Props) {
  const { s, fs } = useScale();
  const size = s(54);
  const icon = s(28);

  return (
    <View style={[styles.row, { gap: s(gap) }]} accessibilityRole="radiogroup">
      {MODES.map(({ id, label, hint, Icon }) => {
        const on = persona === id;
        return (
          <Pressable
            key={id}
            onPress={() => onChange(id)}
            hitSlop={10}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={label}
            accessibilityHint={hint}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            {on ? (
              <View style={[styles.lift, { width: size, height: size, borderRadius: size / 2 }]}>
                <CircleButton size={size}>
                  <Icon width={icon} height={icon} color={colors.cream} />
                </CircleButton>
              </View>
            ) : (
              <View style={[styles.idle, { width: size, height: size, borderRadius: size / 2 }]}>
                <Icon width={icon} height={icon} color={colors.muted} />
              </View>
            )}
            <Text style={[styles.label, { fontSize: fs(12), marginTop: s(6) }, on ? styles.labelOn : null]}>
              {label.toUpperCase()}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", alignItems: "flex-start" },
  item: { alignItems: "center" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  // Soft drop shadow under the chosen button. The dark fill matches the circle art's inked
  // rim, so nothing shows around it; it only gives Android's elevation a round shape to cast.
  lift: {
    backgroundColor: colors.cardStroke,
    elevation: 6,
    shadowColor: "#2A1C0A",
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  // Quiet state: a thin ink ring, no fill block, so the parchment shows through.
  idle: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(63,56,45,0.45)",
  },
  label: { fontFamily: fonts.headingBold, color: colors.muted, letterSpacing: 1.4, includeFontPadding: false },
  labelOn: { color: colors.activeTab },
});
