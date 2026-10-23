import { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

type Props = {
  /** Centre of the orb inside the stage, in dp. */
  cx: number;
  cy: number;
  /** Radius of the orb in dp. The glow is a thin rim just outside it. */
  orbRadius: number;
  /** Glow strength 0..1 (native-driven). */
  glow: Animated.Value;
  /** 0 = red (Wizard), 1 = blue (Plain), native-driven. */
  blue: Animated.Value;
};

const RED = "#E4572E";
const BLUE = "#2BA697";

// How far the glow reaches past the orb's edge: 9% of the orb radius (about 13 dp on an A55).
export const RIM = 0.09;

// A thin rim of heat hugging the orb: a circle filled with a radial gradient in absolute units.
// Inside the orb's radius it is hidden behind the orb; from the orb's edge it fades to exactly
// 0 at the circle's own edge, 9% further out. The circle is 48% of its canvas, so nothing is
// drawn near the canvas edge and no square can show.
function Halo({ id, colour, size, orbRadius }: { id: string; colour: string; size: number; orbRadius: number }) {
  const c = size / 2;
  const r = orbRadius * (1 + RIM);
  const rim = orbRadius / r; // where the orb edge sits on the gradient (about 0.92)
  return (
    <Svg width={size} height={size}>
      <Defs>
        <RadialGradient id={id} cx={c} cy={c} r={r} fx={c} fy={c} gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colour} stopOpacity={0.55} />
          <Stop offset={rim} stopColor={colour} stopOpacity={0.55} />
          <Stop offset={rim + (1 - rim) * 0.45} stopColor={colour} stopOpacity={0.16} />
          <Stop offset="1" stopColor={colour} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={c} cy={c} r={r} fill={`url(#${id})`} />
    </Svg>
  );
}

// Soft heat glow in the voice colour, drawn behind the orb and fire. Two pre-drawn SVG
// gradients (red and blue) whose opacity is glow x colour, so the pulse, the mood changes
// and the red/blue fade all run on the native driver without redrawing the SVG.
function FlameGlow({ cx, cy, orbRadius, glow, blue }: Props) {
  // Canvas just larger than the glow (circle = 48% of it), absolutely positioned so it never
  // takes up layout space.
  const size = Math.ceil((orbRadius * (1 + RIM)) / 0.48);
  const half = size / 2;
  const red = Animated.multiply(glow, blue.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }));
  const teal = Animated.multiply(glow, blue);
  const box = { left: cx - half, top: cy - half, width: size, height: size };

  return (
    <View pointerEvents="none" style={[styles.box, box]}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: red }]}>
        <Halo id="glowRed" colour={RED} size={size} orbRadius={orbRadius} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: teal }]}>
        <Halo id="glowBlue" colour={BLUE} size={size} orbRadius={orbRadius} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute" },
});

export default memo(FlameGlow);
