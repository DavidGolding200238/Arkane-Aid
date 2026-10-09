import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import ScreenFrame from "../components/ScreenFrame";
import { useParty } from "../context/PartyContext";
import { errorText, joinParty } from "../lib/parties";

type Props = { onBack: () => void; onDone: () => void };

export default function JoinPartyScreen({ onBack, onDone }: Props) {
  const { refresh, select } = useParty();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const party = await joinParty(code);
      await refresh();
      select(party.id);
      onDone();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenFrame title="Join" onBack={onBack}>
      <Text style={styles.copy}>Enter the code from the DM. You join as a player.</Text>
      <TextInput
        style={styles.input}
        autoCapitalize="characters"
        placeholder="Party code"
        placeholderTextColor="#8A8175"
        value={code}
        onChangeText={setCode}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={styles.buttonText}>Join party</Text>}
      </Pressable>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  copy: { color: "#1A1816", fontSize: 16, lineHeight: 22 },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#1A1816",
    fontSize: 16,
    backgroundColor: "rgba(254,252,235,0.7)",
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
});
