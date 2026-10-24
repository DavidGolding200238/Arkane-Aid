import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { INK_COLOR } from "./Ink";
import Rule from "./Rule";
import FireLoop from "./flames/FireLoop";
import { useFlameTint, useReduceMotion } from "./flames/useFlameMotion";
import { useVoice, VOICES, type VoiceId } from "../context/VoiceContext";
import { colors, fonts, inkText, useScale } from "../theme";

// Layout in "picker px": the Figma carousel 2280:286 at 3x, 638 x 685, which is the box the
// picker takes up (unchanged). Inside it, drawn separately so nothing is cut off:
// - the drop shadow, one soft image for all three (840 px square, fades to zero inside it, so
//   it spills past the box with no hard edge; the old export baked it into the 638 px canvas,
//   which cut it off in straight lines at the sides);
// - the orb disc, per voice (Figma Sage Red 2231:52, Blue 2320:1208, Green 2320:1458);
// - the fire, the Sage screen's animated loops, placed where the old static fire sat.
// All made by scripts/build-tome-orbs.py.
const ORBS: Record<VoiceId, number> = {
  wizard: require("../../assets/images/tome/voice-orb-wizard.png"),
  plain: require("../../assets/images/tome/voice-orb-plain.png"),
  bard: require("../../assets/images/tome/voice-orb-bard.png"),
};
const SHADOW = require("../../assets/images/tome/orb-shadow.png");
const BOX_W = 638;
const BOX_H = 685;
const ORB_X = 320; // orb centre
const ORB_Y = 323.5;
const DISC = 526; // orb diameter, rim included
const SHADOW_SIZE = 840;
const SHADOW_DROP = 7.07; // the shadow sits a little below the orb
// Fire: the loop canvas (870 x 472 units, see SageOrb) scaled so its flames span the old static
// fire exactly (603 px wide from x 27, top at y 347).
const FIRE_K = 603 / 836.4;
const FIRE = { left: 27 - 20.4 * FIRE_K, top: 347 - 3.6 * FIRE_K, width: 870 * FIRE_K, height: 472 * FIRE_K };
const FIRE_FADE_MS = 300;
// Red arrows, Polygon 26 / 27. 106 x 123 px at 3x.
const ARROW_LEFT = require("../../assets/images/tome/arrow-left.png");
const ARROW_RIGHT = require("../../assets/images/tome/arrow-right.png");
const ARROW_RATIO = 123 / 106;

// Browsing to a voice picks it. A voice marked unavailable can be looked at
// but leaves the saved choice alone.
export default function VoiceCarousel() {
  const { s, fs } = useScale();
  const { voice, setVoice, ready } = useVoice();
  const indexOf = (id: VoiceId) => Math.max(0, VOICES.findIndex((option) => option.id === id));
  const [index, setIndex] = useState(() => indexOf(voice));
  const reduce = useReduceMotion();

  // Jump to the saved voice once it has been read from the device.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync once the saved voice has been read from storage
    if (ready) setIndex(indexOf(voice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const shown = VOICES[index];
  // Only the shown voice's fire loop is mounted (plus the old one during the short fade).
  const { under } = useFlameTint(shown.colour, reduce, FIRE_FADE_MS);
  const step = (delta: number) => {
    const next = (index + delta + VOICES.length) % VOICES.length;
    setIndex(next);
    if (VOICES[next].available) setVoice(VOICES[next].id);
  };

  const orbW = s(212);
  const orbH = (orbW * BOX_H) / BOX_W;
  const px = orbW / BOX_W; // dp per picker px
  const arrowW = s(34);
  const arrowH = arrowW * ARROW_RATIO;
  const savedLabel = VOICES[indexOf(voice)].label;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable
          onPress={() => step(-1)}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Previous voice"
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Image source={ARROW_LEFT} style={{ width: arrowW, height: arrowH }} resizeMode="contain" />
        </Pressable>

        <View
          style={{ width: orbW, height: orbH, zIndex: 0 }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Voice: ${shown.label}${shown.available ? "" : ", coming soon"}`}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
        >
          <View
            style={[styles.fill, !shown.available && styles.soon]}
            needsOffscreenAlphaCompositing={!shown.available}
            pointerEvents="none"
          >
            <Image
              source={SHADOW}
              style={[
                styles.abs,
                {
                  left: (ORB_X - SHADOW_SIZE / 2) * px,
                  top: (ORB_Y + SHADOW_DROP - SHADOW_SIZE / 2) * px,
                  width: SHADOW_SIZE * px,
                  height: SHADOW_SIZE * px,
                },
              ]}
            />
            {VOICES.map((option, i) => (
              <Image
                key={option.id}
                source={ORBS[option.id]}
                style={[
                  styles.abs,
                  {
                    left: (ORB_X - DISC / 2) * px,
                    top: (ORB_Y - DISC / 2) * px,
                    width: DISC * px,
                    height: DISC * px,
                    opacity: i === index ? 1 : 0,
                  },
                ]}
              />
            ))}
            <View
              style={[
                styles.abs,
                { left: FIRE.left * px, top: FIRE.top * px, width: FIRE.width * px, height: FIRE.height * px },
              ]}
            >
              <FireLoop
                width={FIRE.width * px}
                height={FIRE.height * px}
                colour={shown.colour}
                under={under}
                fadeMs={FIRE_FADE_MS}
                still={reduce}
              />
            </View>
          </View>
        </View>

        <Pressable
          onPress={() => step(1)}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Next voice"
          style={({ pressed }) => [styles.arrow, pressed && styles.pressed]}
        >
          <Image source={ARROW_RIGHT} style={{ width: arrowW, height: arrowH }} resizeMode="contain" />
        </Pressable>
      </View>

      <View style={[styles.nameBox, { marginTop: s(2) }]}>
        <Text style={[styles.name, !shown.available && styles.nameSoon, { fontSize: fs(20) }]}>{shown.label}</Text>
        <Rule width={s(82)} color={INK_COLOR} style={{ marginTop: s(2) }} />
      </View>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[styles.caption, { fontSize: fs(13), marginTop: s(6), minHeight: fs(18), paddingHorizontal: s(3) }]}
      >
        {shown.available ? shown.blurb : `Coming soon · the Sage keeps ${savedLabel}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  fill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, overflow: "visible" },
  abs: { position: "absolute" },
  soon: { opacity: 0.45 },
  arrow: { zIndex: 1 },
  pressed: { opacity: 0.6 },
  nameBox: { alignItems: "center" },
  name: { fontFamily: fonts.heading, includeFontPadding: false, ...inkText.heading },
  nameSoon: { color: colors.muted },
  // Muted italic serif, like the Ledger and Codex footnotes. The side padding gives the italic
  // overhang room inside the one-line clip so the last letter is never cut.
  caption: { fontFamily: fonts.heading, fontStyle: "italic", color: colors.muted, textAlign: "center" },
});
