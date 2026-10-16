import type { ReactNode } from "react";
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { colors, radius } from "../theme";

const textures = {
  panel: require("../../assets/images/panels/panel-parchment.jpg"),
  card: require("../../assets/images/panels/card-paper.jpg"),
};

const strokes = {
  panel: colors.panelStroke,
  card: colors.cardStroke,
};

type Props = {
  /** panel = warm parchment (Codex book, Ledger sheet). card = pale paper (Codex cards, Ledger lists). */
  variant?: keyof typeof textures;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
};

// Parchment surface from Figma: texture stretched behind the content and a
// crisp 1 dp border drawn in code, so it stays sharp at any size.
export default function ParchmentPanel({ variant = "panel", children, style, contentStyle }: Props) {
  return (
    <View style={[styles.box, { borderColor: strokes[variant] }, style]}>
      <Image source={textures[variant]} style={styles.texture} resizeMode="stretch" />
      <View style={[styles.content, contentStyle]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.panel,
    backgroundColor: colors.panel,
    overflow: "hidden",
  },
  texture: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" },
  content: { flexGrow: 1 },
});
