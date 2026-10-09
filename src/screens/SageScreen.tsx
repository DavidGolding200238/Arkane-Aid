import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import ScreenFrame from "../components/ScreenFrame";
import { askSage, type SagePersona } from "../lib/sage";
import { errorText } from "../lib/parties";

type Props = { onBack: () => void };

export default function SageScreen({ onBack }: Props) {
  const [persona, setPersona] = useState<SagePersona>("sage");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async () => {
    const trimmed = question.trim();
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
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenFrame title="Sage" onBack={onBack}>
      <View style={styles.avatar}>
        <Text style={styles.avatarMark}>Spline</Text>
        <Text style={styles.avatarText}>Avatar lands here. Authored in Spline, not drawn in the app.</Text>
      </View>

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

      <TextInput
        style={styles.input}
        multiline
        placeholder={persona === "sage" ? "Ask a ruling." : "Say what just happened at the table."}
        placeholderTextColor="#8A8175"
        value={question}
        onChangeText={setQuestion}
      />

      <Pressable style={styles.button} onPress={ask} disabled={busy}>
        {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={styles.buttonText}>Ask</Text>}
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reply ? (
        <View style={styles.reply}>
          <Text style={styles.replyLabel}>{persona === "sage" ? "Sage" : "Scribe"}</Text>
          <Text style={styles.replyBody}>{reply}</Text>
        </View>
      ) : null}
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  avatar: {
    height: 160,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 12,
    backgroundColor: "rgba(254,252,235,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  avatarMark: { color: "#BD7F02", fontSize: 13, letterSpacing: 1.4 },
  avatarText: { marginTop: 8, color: "#1A1816", fontSize: 15, textAlign: "center" },
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
  },
  replyLabel: { color: "#BD7F02", fontSize: 13, marginBottom: 6 },
  replyBody: { color: "#1A1816", fontSize: 17, lineHeight: 24 },
});
