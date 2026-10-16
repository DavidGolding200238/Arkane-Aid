import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, fonts, useScale } from "../theme";

// Torn parchment button from the Tome screen (Figma 2543:1170): textured paper,
// inked #3f382d edge, Asul Bold 14 caps. The art is 546 x 106 px at 3x.
const ART = require("../../assets/images/buttons/btn-torn-parchment.png");
const ART_W = 546 / 3;
const ART_H = 106 / 3;

type Props = {
  label: string;
  onPress: () => void;
  /** Highlights the label, e.g. while the section it opens is showing. */
  active?: boolean;
  /** Width in design dp (360-wide Figma frame). Height keeps the art's ratio. */
  width?: number;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

export default function TornButton({ label, onPress, active, width = 181, accessibilityHint, style }: Props) {
  const { s, fs } = useScale();
  const w = s(width);
  const h = s((width * ART_H) / ART_W);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={active === undefined ? undefined : { expanded: active }}
      hitSlop={4}
      style={({ pressed }) => [{ width: w, height: h }, pressed && styles.pressed, style]}
    >
      <Image source={ART} style={{ position: "absolute", width: w, height: h }} resizeMode="stretch" />
      <View style={styles.center}>
        <Text style={[styles.label, active && styles.active, { fontSize: fs(14) }]} numberOfLines={1}>
          {label.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  label: { fontFamily: fonts.headingBold, color: colors.ink, letterSpacing: 0.6, includeFontPadding: false },
  active: { color: colors.activeTab },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
