import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

const circle = require("../../assets/images/buttons/btn-circle-red.png");

type Props = {
  /** Diameter in dp (already scaled). */
  size: number;
  children?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Textured red circle from Figma (Rectangle 26 with its dark stroke).
// The icon child is centred, so it stays in the middle at any size.
// Without onPress it renders as a plain badge.
export default function CircleButton({ size, children, onPress, accessibilityLabel, disabled, style }: Props) {
  const box = [{ width: size, height: size }, style];
  const content = (
    <>
      <Image source={circle} style={styles.fill} resizeMode="stretch" />
      <View style={styles.center} pointerEvents="none">
        {children}
      </View>
    </>
  );

  if (!onPress) return <View style={box}>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [box, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  center: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
});
