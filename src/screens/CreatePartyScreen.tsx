import { useState } from "react";
import { StyleSheet, Text } from "react-native";
import ScreenFrame, { FrameInput } from "../components/ScreenFrame";
import ThemedButton from "../components/ThemedButton";
import { useParty } from "../context/PartyContext";
import { colors, fonts, useScale } from "../theme";
import { createParty, errorText } from "../lib/parties";

type Props = { onBack: () => void; onDone: () => void };

export default function CreatePartyScreen({ onBack, onDone }: Props) {
  const { refresh, select } = useParty();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { fs } = useScale();

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
    <ScreenFrame title="Create Party" onBack={onBack}>
      <Text style={[styles.copy, { fontSize: fs(15), lineHeight: fs(22) }]}>You become the DM. Supabase returns a 6-character code.</Text>
      <FrameInput
        label="Party name"
        placeholder="Party name"
        value={name}
        onChangeText={setName}
      />
      {error ? <Text style={[styles.error, { fontSize: fs(14) }]}>{error}</Text> : null}
      <ThemedButton label="Create party" onPress={submit} busy={busy} />
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  copy: { fontFamily: fonts.body, color: colors.ink },
  error: { fontFamily: fonts.body, color: colors.wordmark },
});
