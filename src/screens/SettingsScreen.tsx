import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ScreenFrame from "../components/ScreenFrame";
import { useAuth } from "../context/AuthContext";
import { useParty } from "../context/PartyContext";
import { errorText, myProfile, partySeats, type Profile, type Seat } from "../lib/parties";
import type { AppScreen } from "../navigation/screens";

type Props = { onBack: () => void; onOpen: (screen: AppScreen) => void };

export default function SettingsScreen({ onBack, onOpen }: Props) {
  const { user, signOut } = useAuth();
  const { memberships, selected, select, refresh, error } = useParty();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState("");
  const [seats, setSeats] = useState<Record<string, Seat[]>>({});

  useEffect(() => {
    myProfile()
      .then(setProfile)
      .catch((err) => setProfileError(errorText(err)));
  }, [user?.id]);

  useEffect(() => {
    let live = true;
    Promise.all(
      memberships.map(async (row) => [row.party.id, await partySeats(row.party.id)] as const)
    )
      .then((rows) => {
        if (!live) return;
        const next: Record<string, Seat[]> = {};
        for (const [id, list] of rows) next[id] = list;
        setSeats(next);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [memberships]);

  return (
    <ScreenFrame title="Settings" onBack={onBack}>
      <View style={styles.card}>
        <Text style={styles.label}>Signed in</Text>
        <Text style={styles.body}>{user?.email}</Text>
        <Text style={styles.meta}>{profile?.display_name ?? "No profile row yet"}</Text>
        {profileError ? <Text style={styles.error}>{profileError}</Text> : null}
      </View>

      <Text style={styles.label}>Parties</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {memberships.length === 0 ? <Text style={styles.meta}>None yet.</Text> : null}
      {memberships.map((row, index) => {
        const on = selected?.party.id === row.party.id;
        return (
          <Pressable
            key={`${row.party.id}-${row.role}-${index}`}
            style={[styles.card, on && styles.on]}
            onPress={() => select(row.party.id)}
          >
            <Text style={styles.body}>{row.party.name}</Text>
            <Text style={styles.meta}>
              {row.party.code} · {row.role}
              {mine ? ` · ${mine}` : ""}
            </Text>
            {(seats[row.party.id] ?? []).map((seat) => (
              <Text key={seat.user_id} style={styles.seat}>
                {seat.name} · {seat.role}
              </Text>
            ))}
          </Pressable>
        );
      })}

      <Pressable style={styles.button} onPress={() => onOpen("create")}>
        <Text style={styles.buttonText}>Create party</Text>
      </Pressable>
      <Pressable style={styles.ghost} onPress={() => onOpen("join")}>
        <Text style={styles.ghostText}>Join party</Text>
      </Pressable>
      <Pressable onPress={refresh}>
        <Text style={styles.link}>Reload parties</Text>
      </Pressable>
      <Pressable onPress={() => signOut()}>
        <Text style={styles.link}>Sign out</Text>
      </Pressable>
    </ScreenFrame>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 8,
    padding: 12,
    backgroundColor: "rgba(254,252,235,0.75)",
  },
  on: { borderColor: "#BD7F02", borderWidth: 2 },
  label: { color: "#A33A3A", fontSize: 14 },
  body: { color: "#1A1816", fontSize: 16 },
  meta: { color: "#5A5348", fontSize: 13, marginTop: 2 },
  seat: { color: "#1A1816", fontSize: 13, marginTop: 4 },
  button: {
    height: 44,
    borderRadius: 8,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FEFCEB", fontSize: 16 },
  ghost: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#1A1816",
    alignItems: "center",
    justifyContent: "center",
  },
  ghostText: { color: "#1A1816", fontSize: 16 },
  link: { color: "#A33A3A", fontSize: 16 },
  error: { color: "#A33A3A", fontSize: 15 },
});
