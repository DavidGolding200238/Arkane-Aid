import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { askSage, type SagePersona } from "../lib/sage";
import { errorText } from "../lib/parties";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
// Drop the Figma exports here:
// assets/Sage/orb.png, mic.png, pen.png, chevron.png
let orbAsset: any = null;
let micAsset: any = null;
let penAsset: any = null;
try { orbAsset = require("../../assets/Sage/orb.png"); } catch {}
try { micAsset = require("../../assets/Sage/mic.png"); } catch {}
try { penAsset = require("../../assets/Sage/pen.png"); } catch {}

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
    return () => Speech.stop();
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
        setError("Sage returned an empty reply.");
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

      {/* Header — red back + title + underline */}
      <View style={styles.header}>
        <Pressable style={styles.backCircle} onPress={onBack} hitSlop={10}>
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <View style={styles.titleBox}>
          <Text style={styles.title}>SAGE SCRIBE</Text>
          <View style={styles.underline} />
        </View>
        <View style={{ width: 44 }} />
      </View>

      {/* Orb */}
      <View style={styles.orbWrap}>
        {orbAsset ? (
          <Image source={orbAsset} style={styles.orb} resizeMode="contain" />
        ) : (
          <View style={styles.orbFallback}>
            <View style={styles.orbCore} />
          </View>
        )}
      </View>

      {/* Status */}
      <Text style={styles.status}>
        {speaking ? "Listening..." : busy ? "Thinking..." : reply ? "Reply" : "Ready"}
      </Text>

      {/* Pause */}
      <Pressable style={styles.pause} onPress={toggleSpeech}>
        <View style={styles.pauseBar} />
        <View style={styles.pauseBar} />
      </Pressable>

      {/* Persona */}
      <View style={styles.chips}>
        <Pressable style={[styles.chip, persona === "sage" && styles.chipOn]} onPress={() => setPersona("sage")}>
          <Text style={styles.chipText}>Sage</Text>
        </Pressable>
        <Pressable style={[styles.chip, persona === "scribe" && styles.chipOn]} onPress={() => setPersona("scribe")}>
          <Text style={styles.chipText}>Scribe</Text>
        </Pressable>
      </View>

      {/* Input (quill toggles) */}
      {showInput ? (
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            multiline
            placeholder={persona === "sage" ? "Ask a ruling." : "Say what just happened."}
            placeholderTextColor="#8A8175"
            value={question}
            onChangeText={setQuestion}
          />
          <Pressable style={styles.ask} onPress={ask} disabled={busy}>
            {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={styles.askText}>Ask</Text>}
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reply ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>{persona === "sage" ? "Sage" : "Scribe"}</Text>
          <Text style={styles.replyBody}>{reply}</Text>
        </View>
      ) : null}

      {/* Bottom controls */}
      <View style={styles.controls}>
        <Pressable style={styles.ctrlBtn} onPress={() => setShowInput(false)}>
          {micAsset ? <Image source={micAsset} style={styles.ctrlIcon} /> : <Text style={styles.ctrlEmoji}>🎙️</Text>}
        </Pressable>
        <Pressable style={styles.ctrlBtn} onPress={() => setShowInput((v) => !v)}>
          {penAsset ? <Image source={penAsset} style={styles.ctrlIcon} /> : <Text style={styles.ctrlEmoji}>✍️</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#FEFCEB" },
  parchment: { ...StyleSheet.absoluteFillObject, opacity: 0.3 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 50,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FF0000",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: { color: "#FEFCEB", fontSize: 30, marginTop: -3 },
  titleBox: { flex: 1, alignItems: "center" },
  title: {
    fontSize: 26,
    color: "#1A1816",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  underline: {
    marginTop: 3,
    height: 1,
    width: 170,
    backgroundColor: "#2E2E2E",
  },
  orbWrap: {
    alignSelf: "center",
    width: 280,
    height: 280,
    marginTop: 12,
  },
  orb: { width: 280, height: 280 },
  orbFallback: {
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: "#1A0A0A",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 8,
    borderColor: "rgba(255,80,0,0.4)",
  },
  orbCore: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF2200",
  },
  status: {
    textAlign: "center",
    fontSize: 22,
    fontStyle: "italic",
    letterSpacing: 2,
    color: "#4D4D4D",
    marginTop: 10,
  },
  pause: {
    alignSelf: "center",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FF0000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 8,
  },
  pauseBar: {
    width: 4,
    height: 16,
    backgroundColor: "#FFF",
    borderRadius: 2,
  },
  chips: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A1816",
  },
  chipOn: { backgroundColor: "#1A1816" },
  chipText: { color: "#BD7F02", fontSize: 14 },
  inputArea: {
    marginHorizontal: 20,
    marginTop: 10,
    gap: 8,
  },
  input: {
    minHeight: 70,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    padding: 10,
    color: "#1A1816",
    fontSize: 16,
    backgroundColor: "rgba(254,252,235,0.85)",
    textAlignVertical: "top",
  },
  ask: {
    alignSelf: "center",
    height: 40,
    width: 100,
    borderRadius: 8,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  askText: { color: "#FEFCEB", fontSize: 15 },
  error: { color: "#A33A3A", textAlign: "center", marginTop: 6 },
  reply: {
    marginHorizontal: 20,
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: "#BD7F02",
    borderRadius: 8,
    backgroundColor: "rgba(254,252,235,0.9)",
  },
  replyLabel: { color: "#BD7F02", fontSize: 12 },
  replyBody: { color: "#1A1816", fontSize: 16, lineHeight: 22 },
  controls: {
    position: "absolute",
    bottom: 52,
    left: 0,
    right: 0,
    height: 56,
    backgroundColor: "rgba(26,24,22,0.85)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  ctrlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FF0000",
    alignItems: "center",
    justifyContent: "center",
  },
  ctrlIcon: { width: 24, height: 24, tintColor: "#FFF" },
  ctrlEmoji: { fontSize: 20 },
});
