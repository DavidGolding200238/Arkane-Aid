import { memo } from "react";
import { Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";

// The orb fire as two animated WebP loops (red for Wizard, teal for Plain). Each loop is 72
// frames at 24 fps (3 s), made offline from the 8 aligned Figma fire frames by morphing the
// flame shape between them (scripts/build-sage-fire.py), so the fire flows instead of
// stepping. Playback is decoded natively by expo-image: no JS timers, no per-frame work on
// the JS thread. Both loops are 725 x 393 px on the same canvas as the original frames and are
// stretched to exactly the same box, so the orb alignment is unchanged.
export const LOOP_RED = require("../../../assets/images/sage/fire-red-loop.webp");
export const LOOP_BLUE = require("../../../assets/images/sage/fire-blue-loop.webp");
// Reduce Motion: the first frame of each loop, which is the original Figma frame 1.
const STILL_RED = require("../../../assets/images/sage/fire-red-1.png");
const STILL_BLUE = require("../../../assets/images/sage/fire-blue-1.png");

type Props = {
  width: number;
  height: number;
  /** 0 = red, 1 = blue (native-driven), crossfaded over ~600 ms. */
  blue: Animated.Value;
  /** Reduce Motion: show a still frame. */
  still: boolean;
};

function FireLoop({ width, height, blue, still }: Props) {
  // The blue fire fades in and out on top while the red stays solid underneath, so the flames
  // never go see-through mid-fade. Red only switches off once blue is fully on.
  const redOpacity = blue.interpolate({ inputRange: [0, 0.999, 1], outputRange: [1, 1, 0], extrapolate: "clamp" });
  const layer = (source: number) => (
    <Image
      source={source}
      style={{ width, height }}
      contentFit="fill"
      autoplay={!still}
      transition={0}
      cachePolicy="memory-disk"
      accessible={false}
    />
  );
  return (
    <>
      <Animated.View style={[styles.layer, { opacity: redOpacity }]}>{layer(still ? STILL_RED : LOOP_RED)}</Animated.View>
      <Animated.View style={[styles.layer, { opacity: blue }]}>{layer(still ? STILL_BLUE : LOOP_BLUE)}</Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0 },
});

export default memo(FireLoop);
