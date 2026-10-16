import { useEffect, useRef } from "react";
import {
  Animated,
  BackHandler,
  Easing,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ParchmentPanel from "./ParchmentPanel";
import Rule from "./Rule";
import ThemedButton from "./ThemedButton";
import type { SagePersona } from "../lib/sage";
import { colors, fonts, spacing, useScale } from "../theme";

type Props = {
  visible: boolean;
  persona: SagePersona;
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onClose: () => void;
  /** Shown under the input, e.g. "Three characters at least." */
  error?: string;
};

// Parchment pop-up for typing a question (Sage) or a table note (Scribe).
// It covers the Sage screen with a dim backdrop and rides above the keyboard.
// Tap the backdrop, Cancel or the Android back button to close it.
export default function SageAskSheet({ visible, persona, value, onChangeText, onSend, onClose, error }: Props) {
  const { s, fs } = useScale();
  const anim = useRef(new Animated.Value(0)).current;
  const sage = persona === "sage";

  useEffect(() => {
    if (!visible) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, anim, onClose]);

  if (!visible) return null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior="padding">
      <Animated.View style={[styles.backdrop, { opacity: anim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View
        style={{
          paddingHorizontal: s(spacing.lg),
          paddingBottom: s(spacing.lg),
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [s(40), 0] }) }],
        }}
      >
        <ParchmentPanel
          variant="ledger"
          contentStyle={{ paddingHorizontal: s(20), paddingTop: s(18), paddingBottom: s(16), gap: s(spacing.sm) }}
        >
          <Text style={[styles.title, { fontSize: fs(15) }]}>{sage ? "ASK THE SAGE" : "TELL THE SCRIBE"}</Text>
          <Rule color={colors.rule} style={styles.rule} width="100%" />
          <TextInput
            style={[styles.input, { fontSize: fs(16), lineHeight: fs(22), minHeight: s(84), maxHeight: s(160) }]}
            multiline
            autoFocus
            placeholder={sage ? "Ask a ruling..." : "What just happened at the table?"}
            placeholderTextColor={colors.placeholder}
            value={value}
            onChangeText={onChangeText}
            accessibilityLabel={sage ? "Question for the Sage" : "Note for the Scribe"}
          />
          {error ? (
            <Text style={[styles.error, { fontSize: fs(13) }]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          <View style={[styles.actions, { gap: s(spacing.sm), marginTop: s(spacing.xs) }]}>
            <ThemedButton label="Cancel" variant="outline" onPress={onClose} style={{ minWidth: s(96) }} />
            <ThemedButton label={sage ? "Ask" : "Note"} onPress={onSend} style={{ minWidth: s(104) }} />
          </View>
        </ParchmentPanel>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "flex-end", zIndex: 50, elevation: 50 },
  backdrop: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(26,24,22,0.5)" },
  title: { fontFamily: fonts.headingBold, color: colors.ink, letterSpacing: 1 },
  rule: { alignSelf: "stretch", opacity: 0.6 },
  input: { fontFamily: fonts.body, color: colors.ink, textAlignVertical: "top", padding: 0 },
  error: { fontFamily: fonts.body, color: colors.wordmark },
  actions: { flexDirection: "row", justifyContent: "flex-end" },
});
