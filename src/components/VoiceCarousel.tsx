import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Rule from "./Rule";
import { useVoice, VOICES, type VoiceId } from "../context/VoiceContext";
import { colors, fonts, inkText, useScale } from "../theme";

// Orb art: the Figma Sage colour variants (Red 2231:52, Blue 2320:1208,
// Green 2320:1458), orb plus flames, laid out like carousel 2280:286.
// 638 x 685 px at 3x; the orb itself is 518 px wide inside that.
const ORBS: Record<VoiceId, number> = {
  wizard: require("../../assets/images/tome/voice-orb-wizard.png"),
  plain: require("../../assets/images/tome/voice-orb-plain.png"),
  bard: require("../../assets/images/tome/voice-orb-bard.png"),
};
const ORB_RATIO = 685 / 638;
// Red arrows, Polygon 26 / 27. 106 x 123 px at 3x.
const ARROW_LEFT = require("../../assets/images/tome/arrow-left.png");
const ARROW_RIGHT = require("../../assets/images/tome/arrow-right.png");
const ARROW_RATIO = 123 / 106;

// Browsing to a voice picks it. A voice that is not ready yet (Bard) can be
// looked at but leaves the saved choice alone.
export default function VoiceCarousel() {
  const { s, fs } = useScale();
  const { voice, setVoice, ready } = useVoice();
  const indexOf = (id: VoiceId) => Math.max(0, VOICES.findIndex((option) => option.id === id));
  const [index, setIndex] = useState(() => indexOf(voice));

  // Jump to the saved voice once it has been read from the device.
  useEffect(() => {
    if (ready) setIndex(indexOf(voice));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const shown = VOICES[index];
  const step = (delta: number) => {
    const next = (index + delta + VOICES.length) % VOICES.length;
    setIndex(next);
    if (VOICES[next].available) setVoice(VOICES[next].id);
  };

  const orbW = s(212);
  const orbH = orbW * ORB_RATIO;
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
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Image source={ARROW_LEFT} style={{ width: arrowW, height: arrowH }} resizeMode="contain" />
        </Pressable>

        <View
          style={{ width: orbW, height: orbH }}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={`Voice: ${shown.label}${shown.available ? "" : ", coming soon"}`}
          accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
          onAccessibilityAction={(event) => step(event.nativeEvent.actionName === "increment" ? 1 : -1)}
        >
          {VOICES.map((option, i) => (
            <Image
              key={option.id}
              source={ORBS[option.id]}
              style={[
                styles.orb,
                { width: orbW, height: orbH, opacity: i === index ? (option.available ? 1 : 0.45) : 0 },
              ]}
              resizeMode="contain"
            />
          ))}
        </View>

        <Pressable
          onPress={() => step(1)}
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Next voice"
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Image source={ARROW_RIGHT} style={{ width: arrowW, height: arrowH }} resizeMode="contain" />
        </Pressable>
      </View>

      <View style={[styles.nameBox, { marginTop: s(2) }]}>
        <Text style={[styles.name, !shown.available && styles.nameSoon, { fontSize: fs(20) }]}>{shown.label}</Text>
        <Rule width={s(82)} thickness={1.5} color={colors.rule} style={{ marginTop: s(2) }} />
      </View>
      <Text style={[styles.caption, { fontSize: fs(13), marginTop: s(6), minHeight: fs(18) }]}>
        {shown.available ? "The Sage will speak with this voice" : `Coming soon · the Sage keeps ${savedLabel}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", alignSelf: "stretch" },
  orb: { position: "absolute", top: 0, left: 0 },
  pressed: { opacity: 0.6 },
  nameBox: { alignItems: "center" },
  name: { fontFamily: fonts.heading, includeFontPadding: false, ...inkText.heading },
  nameSoon: { color: colors.muted },
  caption: { fontFamily: fonts.body, color: colors.muted, textAlign: "center" },
});
