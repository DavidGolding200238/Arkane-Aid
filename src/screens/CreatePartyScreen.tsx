import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput } from "react-native";
import ScreenFrame from "../components/ScreenFrame";
import { useParty } from "../context/PartyContext";
import { createParty, errorText } from "../lib/parties";

type Props = { onBack: () => void; onDone: () => void };

export default function CreatePartyScreen({ onBack, onDone }: Props) {
  const { refresh, select } = useParty();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError("");
    setBusy(true);
    try {
      const party = await createParty(name);
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
    <ScreenFrame title="Create" onBack={onBack}>
      <Text style={styles.copy}>You become the DM. Supabase returns a 6-character code.</Text>
      <TextInput
        style={styles.input}
        placeholder="Party name"
        placeholderTextColor="#8A8175"
        value={name}
        onChangeText={setName}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={submit} disabled={busy}>
        {busy ? <ActivityIndicator color="#FEFCEB" /> : <Text style={styles.buttonText}>Create party</Text>}
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
