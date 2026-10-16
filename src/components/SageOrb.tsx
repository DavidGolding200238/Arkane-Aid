import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import SageAvatar from "./SageAvatar";

// Orb fire (Figma component set 2189:64). All 16 frames share one 870 x 472 px
// canvas at 3x, so every frame lines up with the next. Red for the Wizard voice,
// teal/blue (Figma 2320:1208) for Plain.
const FIRE_RED = [
  require("../../assets/images/sage/fire-red-1.png"),
  require("../../assets/images/sage/fire-red-2.png"),
  require("../../assets/images/sage/fire-red-3.png"),
  require("../../assets/images/sage/fire-red-4.png"),
  require("../../assets/images/sage/fire-red-5.png"),
  require("../../assets/images/sage/fire-red-6.png"),
  require("../../assets/images/sage/fire-red-7.png"),
  require("../../assets/images/sage/fire-red-8.png"),
];
const FIRE_BLUE = [
  require("../../assets/images/sage/fire-blue-1.png"),
  require("../../assets/images/sage/fire-blue-2.png"),
  require("../../assets/images/sage/fire-blue-3.png"),
  require("../../assets/images/sage/fire-blue-4.png"),
  require("../../assets/images/sage/fire-blue-5.png"),
  require("../../assets/images/sage/fire-blue-6.png"),
  require("../../assets/images/sage/fire-blue-7.png"),
  require("../../assets/images/sage/fire-blue-8.png"),
];

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
  /** "red" for the Wizard voice, "blue" for Plain. */
  flame: "red" | "blue";
};

// All frames stay mounted and only the current one is shown, so switching
// frames never waits on an image decode (no flicker on the first loop).
function Fire({ frames, width, left, top }: { frames: number[]; width: number; left: number; top: number }) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setFrame((current) => (current + 1) % frames.length), 120);
    return () => clearInterval(id);
  }, [frames.length]);

  const height = (width * ART_H) / ART_W;
  return (
    <View pointerEvents="none" style={[styles.fire, { width, height, left, top }]}>
      {frames.map((source, index) => (
        <Image
          key={index}
          source={source}
          resizeMode="stretch"
          style={[styles.frame, { width, height, opacity: index === frame ? 1 : 0 }]}
        />
      ))}
    </View>
  );
}

/** The 3D orb with its animated fire, sized so the flames wrap the orb's lower edge. */
export default function SageOrb({ size, flame }: Props) {
  const k = size / (ORB_R * 2); // dp per art pixel
  const fireW = ART_W * k;
  const fireH = ART_H * k;
  // The stage is as wide as the fire; the orb is centred on the art's orb centre.
  const orbLeft = ORB_CX * k - size / 2;
  const orbTop = 0;
  const fireTop = orbTop + size / 2 - ORB_CY * k;
  const stageH = Math.max(orbTop + size, fireTop + fireH);

  return (
    <View style={{ width: fireW, height: stageH }}>
      <View style={[styles.halo, { left: orbLeft, top: orbTop, width: size, height: size, borderRadius: size / 2 }]}>
        <SageAvatar size={size} />
      </View>
      <Fire key={flame} frames={flame === "red" ? FIRE_RED : FIRE_BLUE} width={fireW} left={0} top={fireTop} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Soft dark glow around the orb, like the Figma drop shadow.
  halo: {
    position: "absolute",
    backgroundColor: "#1A0A0A",
    elevation: 14,
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  // Elevation as well as zIndex: on Android a higher elevation always draws on top,
  // so the fire must out-rank the orb halo. It has no background, so it casts no shadow.
  fire: { position: "absolute", zIndex: 2, elevation: 16 },
  frame: { position: "absolute", top: 0, left: 0 },
});
