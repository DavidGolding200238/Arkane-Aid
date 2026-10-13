import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
} from "react-native";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import SageAvatar from "../components/SageAvatar";
import { askSage, type SagePersona } from "../lib/sage";
import { errorText } from "../lib/parties";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");

type Props = { onBack: () => void };

function speakReply(text: string, onEnd: () => void) {
  Speech.stop();
  Speech.speak(text, {
    language: "en",
    rate: 0.92,
    onDone: onEnd,
    onStopped: onEnd,
    onError: onEnd,
  });
}

export default function SageScreen({ onBack }: Props) {
  const [persona, setPersona] = useState<SagePersona>("sage");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const ask = async () => {
    const trimmed = question.trim();
    Speech.stop();
    setSpeaking(false);
    setError("");
    setReply("");
    if (trimmed.length < 3) {
      setError("Ask a real question. Three characters at least.");
      return;
    }
    setBusy(true);
    try {
      const data = await askSage(trimmed, persona);
      const text = String(data?.reply ?? "").trim();
      if (!text) {
        setError("Sage returned an empty reply. Try again, or check the Edge Function logs.");
        return;
      }
      setReply(text);
      setSpeaking(true);
      speakReply(text, () => setSpeaking(false));
      setShowInput(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleSpeech = () => {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    if (!reply) return;
    setSpeaking(true);
    speakReply(reply, () => setSpeaking(false));
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={styles.header}>
        <Pressable style={styles.backBtn} onPress={onBack} hitSlop={12}>
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Sage Scribe</Text>
          <View style={styles.underline} />
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.orbSlot}>
          <SageAvatar />
        </View>

        <Text style={styles.status}>
          {speaking ? "Listening..." : busy ? "Thinking..." : reply ? "Reply" : "Ready"}
        </Text>

        <Pressable style={styles.pauseBtn} onPress={toggleSpeech} disabled={!reply && !speaking}>
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </Pressable>

        <View style={styles.row}>
          <Pressable
            style={[styles.chip, persona === "sage" && styles.chipOn]}
            onPress={() => setPersona("sage")}
          >
            <Text style={styles.chipText}>Sage</Text>
          </Pressable>
          <Pressable
            style={[styles.chip, persona === "scribe" && styles.chipOn]}
            onPress={() => setPersona("scribe")}
          >
            <Text style={styles.chipText}>Scribe</Text>
          </Pressable>
        </View>

        {showInput ? (
          <>
            <TextInput
              style={styles.input}
              multiline
              placeholder={persona === "sage" ? "Ask a ruling." : "Say what just happened at the table."}
              placeholderTextColor="#8A8175"
              value={question}
              onChangeText={setQuestion}
            />
            <Pressable style={styles.askBtn} onPress={ask} disabled={busy}>
              {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={styles.askBtnText}>Ask</Text>}
            </Pressable>
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {reply ? (
          <View style={styles.reply}>
            <Text style={styles.replyLabel}>{persona === "sage" ? "Sage" : "Scribe"}</Text>
            <Text style={styles.replyBody}>{reply}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.controlBar}>
        <Pressable style={styles.controlBtn} onPress={() => setShowInput(false)}>
          <Text style={styles.controlIcon}>🎙️</Text>
        </Pressable>
        <Pressable style={styles.controlBtn} onPress={() => setShowInput((v) => !v)}>
          <Text style={styles.controlIcon}>✍️</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FEFCEB" },
  parchment: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.28,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 52,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FF0000",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: {
    color: "#FEFCEB",
    fontSize: 32,
    lineHeight: 34,
    marginTop: -4,
  },
  titleWrap: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    color: "#1A1816",
    fontWeight: "600",
  },
  underline: {
    marginTop: 4,
    height: 1,
    width: 180,
    backgroundColor: "#2E2E2E",
  },
  body: {
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  orbSlot: {
    width: 280,
    height: 280,
    marginTop: 8,
    borderRadius: 140,
    overflow: "hidden",
  },
  status: {
    fontSize: 22,
    letterSpacing: 2,
    color: "#4D4D4D",
    fontStyle: "italic",
    marginTop: 6,
  },
  pauseBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#FF0000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  pauseBar: {
    width: 5,
    height: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },
  row: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A1816",
  },
  chipOn: { backgroundColor: "#1A1816" },
  chipText: { color: "#BD7F02", fontSize: 15 },
  input: {
    width: "100%",
    minHeight: 80,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    padding: 12,
    color: "#1A1816",
    fontSize: 16,
    backgroundColor: "rgba(254,252,235,0.85)",
    textAlignVertical: "top",
  },
  askBtn: {
    height: 44,
    width: 120,
    borderRadius: 8,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  askBtnText: { color: "#FEFCEB", fontSize: 16 },
  error: { color: "#A33A3A", fontSize: 15 },
  reply: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#BD7F02",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(254,252,235,0.9)",
    gap: 6,
  },
  replyLabel: { color: "#BD7F02", fontSize: 13 },
  replyBody: { color: "#1A1816", fontSize: 17, lineHeight: 24 },
  controlBar: {
    position: "absolute",
    bottom: 56,
    left: 0,
    right: 0,
    height: 64,
    backgroundColor: "rgba(26,24,22,0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF0000",
    alignItems: "center",
    justifyContent: "center",
  },
  controlIcon: { fontSize: 22 },
});
