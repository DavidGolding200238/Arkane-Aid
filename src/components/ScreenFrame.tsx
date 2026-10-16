import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { StatusBar } from "expo-status-bar";
import PageHeader from "./PageHeader";
import ParchmentPanel from "./ParchmentPanel";
import { colors, fonts, inkText, radius, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
const d20 = require("../../assets/images/tome/d20-badge.png");

type Props = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
  subtitle?: string;
};

// Small Tome-styled page: back button and Cinzel title, the glowing d20, and
// the content on a torn parchment sheet. Used by Create party and Join party.
export default function ScreenFrame({ title, onBack, children, footer, subtitle = "Tome" }: Props) {
  const fontsLoaded = useAppFonts();
  const { s } = useScale();

  if (!fontsLoaded) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <PageHeader title={title} subtitle={subtitle} onBack={onBack} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingHorizontal: s(20), paddingTop: s(4), paddingBottom: s(28) }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <Image source={d20} style={[styles.badge, { width: s(64), height: s(64), marginBottom: s(6) }]} resizeMode="contain" />
        <ParchmentPanel
          variant="ledger"
          contentStyle={{ paddingHorizontal: s(18), paddingTop: s(18), paddingBottom: s(20), gap: s(14) }}
        >
          {children}
        </ParchmentPanel>
      </ScrollView>
      {footer}
    </View>
  );
}

// Text field that matches the Tome look: label above, inked outline on cream.
export function FrameInput({ label, style, ...props }: TextInputProps & { label: string }) {
  const { s, fs } = useScale();
  return (
    <View style={{ gap: s(4) }}>
      <Text style={[styles.label, { fontSize: fs(13) }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.placeholder}
        accessibilityLabel={label}
        style={[
          styles.input,
          { minHeight: s(44), paddingHorizontal: s(12), borderRadius: s(radius.panel), fontSize: fs(16) },
          style,
        ]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.wash },
  parchment: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.28,
  },
  scroll: { flex: 1 },
  badge: { alignSelf: "center" },
  label: { fontFamily: fonts.headingBold, color: colors.wordmark, letterSpacing: 0.4, ...inkText.red },
  input: {
    fontFamily: fonts.body,
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.cardStroke,
    backgroundColor: "rgba(254,252,235,0.7)",
  },
});
