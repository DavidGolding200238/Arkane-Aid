import { useState, type ReactNode } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";

import { InkOutline } from "../Ink";
import DiceCanvas from "./DiceCanvas";
import type { DiceStage } from "../../lib/dice/diceStage";
import { colors, fonts, radius, useScale } from "../../theme";

const TRAY_BG = "#1C130B";
/** Gap between the tray and the inked line drawn round it on the paper, in design dp. */
const TRAY_FRAME = 4;
/** The tray's own minimum height in dp. */
export const TRAY_MIN = 160;

/** The dark dice tray inside its hand-inked line, shared by the Check and Free roll tabs.
 *  `gold` edges it in gold (a natural 20); `flash` is the red wash on a natural 1. */
export default function DiceTray({
  stage,
  gold,
  flash,
  minHeight = TRAY_MIN,
  topNote,
  bottomNote,
  children,
}: {
  stage: DiceStage;
  gold: boolean;
  flash: Animated.Value;
  minHeight?: number;
  topNote?: string | null;
  bottomNote?: string | null;
  children?: ReactNode;
}) {
  const { s, fs } = useScale();
  const [ready, setReady] = useState(false);
  const trayRadius = s(radius.panel * 2);
  return (
    // The line never takes touches or changes the tray's size.
    <View style={[styles.trayFrame, { marginTop: s(8), padding: s(TRAY_FRAME), minHeight: minHeight + s(TRAY_FRAME) * 2 }]}>
      <InkOutline seed={73} radius={trayRadius + s(TRAY_FRAME)} />
      <View
        style={[
          styles.tray,
          { minHeight, borderRadius: trayRadius, borderColor: gold ? colors.gold : colors.panelStroke, borderWidth: gold ? 3 : 1.5, padding: gold ? 0 : 1.5 },
        ]}
        onLayout={(e) => {
          if (e.nativeEvent.layout.width > 0 && e.nativeEvent.layout.height > 0) setReady(true);
        }}
      >
        {ready ? <DiceCanvas stage={stage} /> : null}
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: flash }]} />
        {topNote ? (
          <Text pointerEvents="none" style={[styles.trayNote, { top: s(8), fontSize: fs(12) }]}>
            {topNote}
          </Text>
        ) : null}
        {bottomNote ? (
          <Text pointerEvents="none" style={[styles.trayNote, { bottom: s(8), fontSize: fs(12) }]}>
            {bottomNote}
          </Text>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  trayFrame: { flex: 1 },
  tray: { flex: 1, overflow: "hidden", backgroundColor: TRAY_BG },
  trayNote: { position: "absolute", left: 0, right: 0, textAlign: "center", color: colors.panel, fontFamily: fonts.body, opacity: 0.8 },
});
