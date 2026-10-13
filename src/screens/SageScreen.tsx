import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Speech from "expo-speech";
import ScreenFrame from "../components/ScreenFrame";
import SageAvatar from "../components/SageAvatar";
import { askSage, type SagePersona } from "../lib/sage";
import { errorText } from "../lib/parties";

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
  const [listening, setListening] = useState(false);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const ask = async () => {
    const trimmed = question.trim();
    Speech.stop();
    setSpeaking(false);
    setListening(false);
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

  const toggleListen = () => {
    // Placeholder for voice-to-text. When a recognition library is added,
    // this will start/stop and write the transcript into `question`.
    setListening((v) => !v);
    if (!listening) {
      setError("Voice input is ready. Speak, then type or confirm the words below.");
    } else {
      setError("");
    }
  };

  const placeholder =
    persona === "sage"
      ? "Ask a ruling or question."
      : "Say what just happened — Scribe will note it for the ledger.";

  return (
    <ScreenFrame title="Sage Scribe" onBack={onBack}>
      <SageAvatar />

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

      <View style={styles.listenRow}>
        <Pressable style={[styles.mic, listening && styles.micOn]} onPress={toggleListen}>
          <Text style={styles.micText}>{listening ? "Stop" : "Speak"}</Text>
        </Pressable>
        <Text style={styles.listenHint}>
          {listening ? "Listening…" : persona === "sage" ? "Ask by voice" : "Note by voice"}
        </Text>
      </View>

      <TextInput
        style={styles.input}
        multiline
        placeholder={placeholder}
        placeholderTextColor="#8A8175"
        value={question}
        onChangeText={setQuestion}
      />

      <Pressable style={styles.button} onPress={ask} disabled={busy}>
        {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={styles.buttonText}>{persona === "sage" ? "Ask" : "Note"}</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reply ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>{persona === "sage" ? "Sage" : "Scribe"}</Text>
          <Text style={styles.replyBody}>{reply}</Text>
          <Pressable style={styles.hear} onPress={toggleSpeech}>
            <Text style={styles.hearText}>{speaking ? "Stop" : "Hear it again"}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A1816",
  },
  chipOn: { backgroundColor: "#1A1816" },
  chipText: { color: "#BD7F02", fontSize: 15 },
  listenRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mic: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FF0000",
  },
  micOn: { backgroundColor: "#BD7F02" },
  micText: { color: "#FEFCEB", fontSize: 14 },
  listenHint: { color: "#4D4D4D", fontSize: 14, fontStyle: "italic" },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    padding: 12,
    color: "#1A1816",
    fontSize: 16,
    backgroundColor: "rgba(254,252,235,0.7)",
    textAlignVertical: "top",
  },
  button: {
    height: 44,
    borderRadius: 8,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FEFCEB", fontSize: 16 },
  error: { color: "#A33A3A", fontSize: 15 },
  reply: {
    borderWidth: 1,
    borderColor: "#BD7F02",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(254,252,235,0.8)",
    gap: 10,
  },
  replyLabel: { color: "#BD7F02", fontSize: 13 },
  replyBody: { color: "#1A1816", fontSize: 17, lineHeight: 24 },
  hear: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#BD7F02",
  },
  hearText: { color: "#1A1816", fontSize: 15 },
});
