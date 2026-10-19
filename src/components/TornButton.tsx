import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, useScale } from "../theme";

// Torn parchment buttons from the Tome (Figma 2543:1170): textured paper, inked edge.
// `parchment` = cream paper (secondary / social). `red` = brick-red paper (primary actions).
const ART = {
  parchment: require("../../assets/images/buttons/btn-torn-parchment.png"),
  red: require("../../assets/images/buttons/btn-torn-red.png"),
} as const;
const ART_W = 546 / 3;
const ART_H = 106 / 3;

type Props = {
  label: string;
  onPress: () => void;
  variant?: keyof typeof ART;
  /** Highlights the label, e.g. while the section it opens is showing. */
  active?: boolean;
  /** Width in design dp (360-wide Figma frame). Height keeps the art's ratio. */
  width?: number;
  /** When set, stretches to this on-screen width (dp already scaled) instead of `width`. */
  fullWidth?: number;
  busy?: boolean;
  disabled?: boolean;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  /** Optional leading icon (e.g. Google / Facebook mark). */
  icon?: number;
};

export default function TornButton({
  label,
  onPress,
  variant = "parchment",
  active,
  width = 181,
  fullWidth,
  busy,
  disabled,
  accessibilityHint,
  style,
  icon,
}: Props) {
  const { s, fs } = useScale();
  const w = fullWidth ?? s(width);
  const h = fullWidth ? (fullWidth * ART_H) / ART_W : s((width * ART_H) / ART_W);
  const onRed = variant === "red";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={active === undefined ? undefined : { expanded: active }}
      hitSlop={4}
      style={({ pressed }) => [
        { width: w, height: h },
        (disabled || busy) && styles.dim,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Image source={ART[variant]} style={{ position: "absolute", width: w, height: h }} resizeMode="stretch" />
      <View style={[styles.center, icon ? { flexDirection: "row", gap: s(10) } : null]}>
        {busy ? (
          <ActivityIndicator color={onRed ? colors.cream : colors.ink} />
        ) : (
          <>
            {icon ? <Image source={icon} style={{ width: s(20), height: s(20) }} resizeMode="contain" /> : null}
            <Text
              style={[
                styles.label,
                { fontSize: fs(14), color: onRed ? colors.cream : active ? colors.activeTab : colors.ink },
              ]}
              numberOfLines={1}
            >
              {label.toUpperCase()}
            </Text>
          </>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.headingBold, letterSpacing: 0.6, includeFontPadding: false },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
