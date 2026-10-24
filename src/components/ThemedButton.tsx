import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from "react-native";
import { tapHaptic } from "../lib/haptics";
import { colors, fonts, radius, useScale } from "../theme";

type Props = {
  label: string;
  onPress: () => void;
  /** primary = filled brick red. outline = red border for secondary or destructive actions. */
  variant?: "primary" | "outline";
  size?: "small" | "regular";
  busy?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function ThemedButton({
  label,
  onPress,
  variant = "primary",
  size = "regular",
  busy,
  disabled,
  style,
}: Props) {
  const { s, fs } = useScale();
  const small = size === "small";
  const filled = variant === "primary";
  const textColor = filled ? colors.cream : colors.wordmark;

  return (
    <Pressable
      onPress={() => {
        tapHaptic();
        onPress();
      }}
      disabled={disabled || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={small ? 8 : 4}
      style={({ pressed }) => [
        styles.base,
        filled ? styles.primary : styles.outline,
        {
          minHeight: s(small ? 30 : 42),
          paddingHorizontal: s(small ? 14 : 20),
          borderRadius: s(radius.button),
        },
        (disabled || busy) && styles.dim,
        pressed && styles.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor, fontSize: fs(small ? 13 : 16) }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center", borderWidth: 1 },
  primary: { backgroundColor: colors.primary, borderColor: colors.cardStroke },
  outline: { backgroundColor: "rgba(254,252,235,0.55)", borderColor: colors.wordmark },
  label: { fontFamily: fonts.headingBold, letterSpacing: 0.4 },
  dim: { opacity: 0.6 },
  pressed: { opacity: 0.85 },
});
