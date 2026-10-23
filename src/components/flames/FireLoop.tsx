import { memo, useEffect, useState } from "react";
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
  /** Length of the fade from the old fire to the new one, in ms. */
  fadeMs?: number;
  /** Reduce Motion: show a still frame. */
  still: boolean;
};

// One fire layer. A layer that mounts during a colour change fades itself in from 0 to 1 with its
// own value. On Expo SDK 58 (RN 0.88) the shared native-driven tint never showed a fire that was
// mounted after the screen opened: the Tome picker kept the first fire (blue) for every voice.
// This fade is JS-driven, so its value is real and the layer always ends fully opaque.
function Layer({ fadeIn, fadeMs, children }: { fadeIn: boolean; fadeMs: number; children: React.ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(fadeIn ? 0 : 1));
  useEffect(() => {
    if (!fadeIn) return;
    const fade = Animated.timing(opacity, { toValue: 1, duration: fadeMs, useNativeDriver: false });
    fade.start(({ finished }) => {
      if (!finished) opacity.setValue(1);
    });
    return () => fade.stop();
    // Only on mount: a layer fades in once, when its colour arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <Animated.View style={[styles.layer, { opacity }]} pointerEvents="none">
      {children}
    </Animated.View>
  );
}

// Only the shown fire is mounted (plus the old one for the ~600 ms of a colour change), so only
// one loop decodes at a time. The new fire fades in on top while the old stays solid underneath,
// so the flames never go see-through mid-fade.
function FireLoop({ width, height, colour, under, fadeMs = 600, still }: Props) {
  const fading = !!under && under !== colour;
  const layer = (c: FlameColour, top: boolean) => (
    <Layer key={c} fadeIn={top && fading && !still} fadeMs={fadeMs}>
      <Image
        source={still ? STILLS[c] : LOOPS[c]}
        style={{ width, height }}
        contentFit="fill"
        autoplay={!still}
        transition={0}
        cachePolicy="memory-disk"
        accessible={false}
      />
    </Layer>
  );
  // Always a keyed list, so the shown fire keeps playing (no remount) when the old one leaves.
  return <>{[fading ? layer(under, false) : null, layer(colour, true)]}</>;
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, left: 0 },
});

export default memo(FireLoop);
