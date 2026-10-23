import { memo } from "react";
import { Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import type { FlameColour } from "./useFlameMotion";

type Props = {
  /** Centre of the orb inside the stage, in dp. */
  cx: number;
  cy: number;
  /** Radius of the orb in dp. The glow is a thin rim just outside it. */
  orbRadius: number;
  /** Glow strength 0..1 (native-driven). */
  glow: Animated.Value;
  /** The shown colour, and the old one while the colour changes (see useFlameMotion). */
  colour: FlameColour;
  under?: FlameColour | null;
  /** How much of each colour shows, native-driven. */
  tint: Record<FlameColour, Animated.Value>;
};

// Red for Wizard, teal for Arbiter, emerald for Bard (matching the green fire's body).
const GLOW: Record<FlameColour, string> = { red: "#E4572E", blue: "#2BA697", green: "#3DB35A" };

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

// Soft heat glow in the voice colour, drawn behind the orb and fire. Pre-drawn SVG gradients
// (the shown colour, plus the old one during a colour change) whose opacity is glow x tint, so
// the pulse, the mood changes and the colour fade all run on the native driver without
// redrawing the SVG.
function FlameGlow({ cx, cy, orbRadius, glow, colour, under, tint }: Props) {
  // Canvas just larger than the glow (circle = 48% of it), absolutely positioned so it never
  // takes up layout space.
  const size = Math.ceil((orbRadius * (1 + RIM)) / 0.48);
  const half = size / 2;
  const box = { left: cx - half, top: cy - half, width: size, height: size };
  const shown = under && under !== colour ? [under, colour] : [colour];

  return (
    <View pointerEvents="none" style={[styles.box, box]}>
      {shown.map((c) => (
        <Animated.View key={c} style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(glow, tint[c]) }]}>
          <Halo id={`glow-${c}`} colour={GLOW[c]} size={size} orbRadius={orbRadius} />
        </Animated.View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: "absolute" },
});

export default memo(FlameGlow);
