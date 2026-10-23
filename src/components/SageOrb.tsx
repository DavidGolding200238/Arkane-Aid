import { memo } from "react";
import { StyleSheet, View } from "react-native";
import SageAvatar from "./SageAvatar";
import FireLoop from "./flames/FireLoop";
import { colors } from "../theme";
import FlameGlow from "./flames/FlameGlow";
import Embers from "./flames/Embers";
import { useFlameMotion, useReduceMotion, type FlameColour, type FlameMood } from "./flames/useFlameMotion";

// Orb fire (Figma component set 2189:64, teal 2320:1208; green is the red fire recoloured), played
// as a smooth animated loop (see flames/FireLoop). The loops share the original 870 x 472 px (3x) canvas.
// Where the orb sits inside the fire art, measured on the 870 x 472 px canvas:
// a circle of radius 378 px centred at (443, 10) runs through the solid part of
// the flames in every frame, so its lower edge never peeks out.
const ART_W = 870;
const ART_H = 472;
const ORB_R = 378;
const ORB_CX = 443;
const ORB_CY = 10;

type Props = {
  /** Orb diameter in dp (already scaled). */
  size: number;
  /** "red" for the Wizard voice, "blue" for Arbiter, "green" for Bard. Changing it fades between them. */
  flame: FlameColour;
  /** What the Sage is doing; sets the flames' pace, glow and embers. */
  mood?: FlameMood;
};

/** The 3D orb with its animated fire, sized so the flames wrap the orb's lower edge. */
function SageOrb({ size, flame, mood = "idle" }: Props) {
  const reduce = useReduceMotion();
  const { tint, under, glow, emberGapMs } = useFlameMotion(mood, flame, reduce);
  const k = size / (ORB_R * 2); // dp per art pixel
  const fireW = ART_W * k;
  const fireH = ART_H * k;
  // The stage is as wide as the fire; the orb is centred on the art's orb centre.
  const orbLeft = ORB_CX * k - size / 2;
  const orbTop = 0;
  const fireTop = orbTop + size / 2 - ORB_CY * k;
  const stageH = Math.max(orbTop + size, fireTop + fireH);
  const orbCx = ORB_CX * k;
  const orbCy = orbTop + size / 2;

  return (
    <View style={{ width: fireW, height: stageH }}>
      <FlameGlow cx={orbCx} cy={orbCy} orbRadius={size / 2} glow={glow} colour={flame} under={under} tint={tint} />
      <View style={[styles.halo, { left: orbLeft, top: orbTop, width: size, height: size, borderRadius: size / 2 }]}>
        <SageAvatar size={size} />
      </View>
      <View pointerEvents="none" style={[styles.fire, { width: fireW, height: fireH, left: 0, top: fireTop }]}>
        {/* One fire, never scaled or faded, so the orb edge stays covered exactly as aligned. */}
        <FireLoop width={fireW} height={fireH} colour={flame} under={under} tint={tint} still={reduce} />
      </View>
      {reduce ? null : (
        <View pointerEvents="none" style={styles.embers}>
          <Embers cx={orbCx} cy={orbCy} radius={size / 2} colour={flame} under={under} tint={tint} gapMs={emberGapMs} />
        </View>
      )}
    </View>
  );
}

// Memoised: the screen re-renders on every keystroke, the flames only need to when
// the size, colour or mood changes.
export default memo(SageOrb);

const styles = StyleSheet.create({
  // Soft dark glow around the orb, like the Figma drop shadow.
  halo: {
    position: "absolute",
    backgroundColor: colors.orbBackdrop,
    elevation: 14,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  // Elevation as well as zIndex: on Android a higher elevation always draws on top,
  // so the fire must out-rank the orb halo. It has no background, so it casts no shadow.
  fire: { position: "absolute", zIndex: 2, elevation: 16 },
  // Embers float over the fire and the orb; no background, so no shadow either.
  embers: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 3, elevation: 17 },
});
