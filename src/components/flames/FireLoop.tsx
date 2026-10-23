import { memo } from "react";
import { Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";
import type { FlameColour } from "./useFlameMotion";

// The orb fire as animated WebP loops: red for Wizard, teal for Arbiter, green for Bard. Each loop
// is 72 frames at 24 fps (3 s), made offline from the 8 aligned Figma fire frames by morphing the
// flame shape between them (scripts/build-sage-fire.py), so the fire flows instead of stepping;
// the green one is the red fire recoloured frame by frame. Playback is decoded natively by
// expo-image: no JS timers, no per-frame work on the JS thread. All loops are 725 x 393 px on the
// same canvas as the original frames and are stretched to exactly the same box, so the orb
// alignment is the same for every colour.
export const LOOPS: Record<FlameColour, number> = {
  red: require("../../../assets/images/sage/fire-red-loop.webp"),
  blue: require("../../../assets/images/sage/fire-blue-loop.webp"),
  green: require("../../../assets/images/sage/fire-green-loop.webp"),
};
// Reduce Motion: the first frame of each loop, which is the original Figma frame 1.
export const STILLS: Record<FlameColour, number> = {
  red: require("../../../assets/images/sage/fire-red-1.png"),
  blue: require("../../../assets/images/sage/fire-blue-1.png"),
  green: require("../../../assets/images/sage/fire-green-1.png"),
};

type Props = {
  width: number;
  height: number;
  /** The fire to show. */
  colour: FlameColour;
  /** While the colour changes: the old fire, kept solid underneath (see useFlameMotion). */
  under?: FlameColour | null;
  /** How much of each colour shows (native-driven); only the new colour's value is used. */
  tint?: Record<FlameColour, Animated.Value>;
  /** Reduce Motion: show a still frame. */
  still: boolean;
};

// Only the shown fire is mounted (plus the old one for the ~600 ms of a colour change), so only
// one loop decodes at a time. The new fire fades in on top while the old stays solid underneath,
// so the flames never go see-through mid-fade.
function FireLoop({ width, height, colour, under, tint, still }: Props) {
  const layer = (c: FlameColour, top: boolean) => (
    <Animated.View key={c} style={[styles.layer, top && tint ? { opacity: tint[c] } : null]} pointerEvents="none">
      <Image
        source={still ? STILLS[c] : LOOPS[c]}
        style={{ width, height }}
        contentFit="fill"
        autoplay={!still}
        transition={0}
        cachePolicy="memory-disk"
        accessible={false}
      />
    </Animated.View>
  );
  // Always a keyed list, so the shown fire keeps playing (no remount) when the old one leaves.
  return <>{[under && under !== colour ? layer(under, false) : null, layer(colour, true)]}</>;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0 },
});

export default memo(FireLoop);
