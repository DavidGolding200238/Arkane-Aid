import { Image, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme";

// The inked underline from the splash heading (Figma "Rectangle 4901": a 1 px rule roughened
// by a fractal-noise displacement), extended so its wobble keeps the same rhythm at any width.
// Two slices: a long body (420 dp, starting with the left cap) clipped to the width, plus the
// rounded right end. Both are a single ink colour with alpha, so tintColor recolours them.
const BODY = require("../../assets/images/decor/ink-underline@3x.png"); // 1260 x 7 px
const END = require("../../assets/images/decor/ink-underline-end@3x.png"); // 30 x 7 px
const BODY_W = 1260 / 3;
const END_W = 30 / 3;
const ART_H = 7 / 3; // the ink itself is about 1 dp thick inside this box

type Props = {
  width?: DimensionValue;
  color?: string;
  /** Ink weight; 1 matches the Figma underline. The art scales with it. */
  thickness?: number;
  style?: StyleProp<ViewStyle>;
};

// The underline for headings and the thin dividers. It takes up exactly the same layout space a
// plain `thickness` dp line did (the taller art hangs over it, centred), so nothing moves.
export default function Rule({ width = "100%", color = colors.rule, thickness = 1, style }: Props) {
  const h = ART_H * thickness;
  const bleed = (h - thickness) / 2;
  return (
    <View
      pointerEvents="none"
      style={[styles.slot, { width, height: thickness }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[styles.row, { top: -bleed, height: h }]}>
        <View style={styles.body}>
          <Image source={BODY} style={{ width: BODY_W * thickness, height: h, tintColor: color }} resizeMode="stretch" />
        </View>
        <Image source={END} style={{ width: END_W * thickness, height: h, tintColor: color }} resizeMode="stretch" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: "center", overflow: "visible" },
  row: { position: "absolute", left: 0, right: 0, flexDirection: "row" },
  body: { flex: 1, overflow: "hidden" },
});
