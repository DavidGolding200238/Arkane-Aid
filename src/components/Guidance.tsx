import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { InkButton } from "./Ink";
import NoteSheet from "./NoteSheet";
import { GUIDANCE, guidanceSeen, markGuidanceSeen } from "../lib/guidance";
import { colors, fonts, inkText, useScale } from "../theme";

// The numbered how-to tips, shared by the first-open pop-up and the Tome's Guidance entry.
// Atkinson Hyperlegible for the text, with roomy lines, so it is easy to read.
export function GuidanceTips() {
  const { s, fs } = useScale();
  return (
    <View style={{ gap: s(12) }}>
      {GUIDANCE.map((tip, index) => (
        <View key={tip.title} style={[styles.row, { gap: s(10) }]}>
          <Text style={[styles.number, { fontSize: fs(20), width: s(18) }]}>{index + 1}</Text>
          <View style={styles.flex}>
            <Text style={[styles.title, { fontSize: fs(15), lineHeight: fs(21) }]}>{tip.title}</Text>
            <Text style={[styles.body, { fontSize: fs(15), lineHeight: fs(22) }]}>{tip.body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// Shown once per account on this phone, the first time the dashboard opens after signing in.
// "Got it" closes it for good; the same tips stay under Guidance in the Tome.
export function GuidancePopup({ userId }: { userId: string }) {
  const { s, fs, width, height } = useScale();
  const [open, setOpen] = useState(() => !guidanceSeen(userId));
  const close = () => {
    markGuidanceSeen(userId);
    setOpen(false);
  };
  const cardW = Math.min(width - s(32), s(400));
  const pad = s(18);

  return (
    <Modal visible={open} transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={{ width: cardW, maxHeight: height * 0.82 }}>
          <NoteSheet seed={57} />
          <View style={{ paddingHorizontal: pad, paddingTop: s(16), paddingBottom: s(14), flexShrink: 1 }}>
            <Text style={[styles.heading, { fontSize: fs(20), marginBottom: s(10) }]} accessibilityRole="header">
              How to use Arkane Aid
            </Text>
            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: s(4) }}>
              <GuidanceTips />
            </ScrollView>
            <View style={[styles.center, { marginTop: s(14) }]}>
              <InkButton label="Got it" variant="red" width={cardW - pad * 2} height={s(46)} onPress={close} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(26,24,22,0.55)" },
  scroll: { flexGrow: 0, flexShrink: 1 },
  center: { alignItems: "center" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  flex: { flex: 1 },
  heading: { fontFamily: fonts.headingBold, textAlign: "center", ...inkText.heading },
  number: { fontFamily: fonts.stat, color: colors.wordmark, textAlign: "center" },
  title: { fontFamily: fonts.headingBold, ...inkText.heading },
  body: { fontFamily: fonts.body, color: colors.ink },
});
