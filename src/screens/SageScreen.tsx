import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Speech from "expo-speech";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";
import SageAvatar from "../components/SageAvatar";
import { useParty } from "../context/PartyContext";
import { loadCharacter, loadEquipment, sheetBrief } from "../lib/character";
import { addCodexEntry } from "../lib/codex";
import { askSage, type SagePersona } from "../lib/sage";
import { errorText } from "../lib/parties";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");

const FIRE = [
  require("../../assets/Fire/Property 1=Variant2.png"),
  require("../../assets/Fire/Property 1=Variant3.png"),
  require("../../assets/Fire/Property 1=Variant4.png"),
  require("../../assets/Fire/Property 1=Variant5.png"),
  require("../../assets/Fire/Property 1=Variant6.png"),
  require("../../assets/Fire/Property 1=Variant7.png"),
  require("../../assets/Fire/Property 1=Variant8.png"),
  require("../../assets/Fire/Property 1=Variant9.png"),
];

const ORB = 260;
const FIRE_W = 390;
const FIRE_H = 170;
const STAGE_W = FIRE_W;
const STAGE_H = ORB + 56;

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

function OrbFire() {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setFrame((current) => (current + 1) % FIRE.length);
    }, 120);
    return () => clearInterval(id);
  }, []);

  return (
    <Image
      source={FIRE[frame]}
      resizeMode="contain"
      style={styles.fire}
    />
  );
}

function noteTitle(text: string) {
  const line = text.split(/\n|\./)[0]?.trim() || text.trim();
  return line.length > 48 ? `${line.slice(0, 45)}...` : line;
}

export default function SageScreen({ onBack }: Props) {
  const { selected } = useParty();
  const partyId = selected?.party.id ?? null;
  const [persona, setPersona] = useState<SagePersona>("sage");
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState("");
  const [noted, setNoted] = useState("");
  const [sheetLine, setSheetLine] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
  });

  const titleFont = fontsLoaded ? "CinzelDecorative_400Regular" : undefined;
  const bodyFont = fontsLoaded ? "AtkinsonHyperlegible_400Regular" : undefined;

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
    setNoted("");
    setSheetLine("");
    if (trimmed.length < 3) {
      setError("Ask a real question. Three characters at least.");
      return;
    }
    setBusy(true);
    try {
      const character = await loadCharacter(partyId);
      const gear = character ? await loadEquipment(character.id) : [];
      const brief = sheetBrief(character, gear);
      const asked = brief
        ? `Player sheet:\n${brief}\n\nUse the sheet only if this question depends on the character, their stats, gear, or traits. For a general rule, ignore the sheet.\n\nQuestion: ${trimmed}`
        : trimmed;
      if (brief) {
        const name = character?.name || "your character";
        setSheetLine(`Sheet ready for ${name}. Used only if the question needs it.`);
      } else {
        setSheetLine("No sheet yet. Sage is answering without one.");
      }
      const data = await askSage(asked, persona, brief);
      const text = String(data?.reply ?? "").trim();
      if (!text) {
        setError("Sage returned an empty reply. Try again, or check the Edge Function logs.");
        return;
      }
      setReply(text);
      if (persona === "scribe") {
        if (!partyId) {
          setError("Join a party first. The note needs a table to land in.");
        } else {
          await addCodexEntry(partyId, "note", noteTitle(trimmed), text, "scribe");
          setNoted("Written to the Codex.");
        }
      }
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

  const status = speaking ? "Speaking..." : busy ? "Thinking..." : reply ? "Reply ready" : "Ready";

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={styles.header}>
        <Pressable style={styles.backCircle} onPress={onBack} hitSlop={10}>
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <View style={styles.titleBox}>
          <Text style={[styles.title, titleFont ? { fontFamily: titleFont } : null]}>SAGE SCRIBE</Text>
          <View style={styles.underline} />
        </View>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        <View style={styles.orbStage}>
          <View style={styles.orbRing}>
            <SageAvatar />
          </View>
          <OrbFire />
        </View>

        <Text style={[styles.status, bodyFont ? { fontFamily: bodyFont } : null]}>{status}</Text>

        <Pressable
          style={[styles.pause, !reply && !speaking && styles.pauseOff]}
          onPress={toggleSpeech}
          disabled={!reply && !speaking}
        >
          <View style={styles.pauseBar} />
          <View style={styles.pauseBar} />
        </Pressable>
        <Text style={[styles.pauseHint, bodyFont ? { fontFamily: bodyFont } : null]}>
          {speaking ? "Tap to stop the reply" : reply ? "Tap to hear the reply" : "The reply plays here"}
        </Text>

        <View style={styles.modes}>
          <Pressable
            style={[styles.mode, persona === "sage" && styles.modeOn]}
            onPress={() => setPersona("sage")}
          >
            <Text style={[styles.modeTitle, bodyFont ? { fontFamily: bodyFont } : null]}>Sage</Text>
            <Text
              style={[
                styles.modeBody,
                persona === "sage" && styles.modeBodyOn,
                bodyFont ? { fontFamily: bodyFont } : null,
              ]}
            >
              Ask a ruling
            </Text>
          </Pressable>
          <Pressable
            style={[styles.mode, persona === "scribe" && styles.modeOn]}
            onPress={() => setPersona("scribe")}
          >
            <Text style={[styles.modeTitle, bodyFont ? { fontFamily: bodyFont } : null]}>Scribe</Text>
            <Text
              style={[
                styles.modeBody,
                persona === "scribe" && styles.modeBodyOn,
                bodyFont ? { fontFamily: bodyFont } : null,
              ]}
            >
              Note the table
            </Text>
          </Pressable>
        </View>

        <View style={styles.work}>
          <Text style={[styles.workLabel, bodyFont ? { fontFamily: bodyFont } : null]}>
            {persona === "sage" ? "Question" : "What just happened"}
          </Text>
          <TextInput
            style={[styles.input, bodyFont ? { fontFamily: bodyFont } : null]}
            multiline
            placeholder={persona === "sage" ? "Ask a ruling." : "Say what just happened at the table."}
            placeholderTextColor="#8A8175"
            value={question}
            onChangeText={setQuestion}
          />
          <Pressable style={styles.button} onPress={ask} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#FEFCEB" />
            ) : (
              <Text style={[styles.buttonText, bodyFont ? { fontFamily: bodyFont } : null]}>
                {persona === "sage" ? "Ask" : "Note"}
              </Text>
            )}
          </Pressable>
          {sheetLine ? (
            <Text style={[styles.noted, bodyFont ? { fontFamily: bodyFont } : null]}>{sheetLine}</Text>
          ) : null}
          {noted ? (
            <Text style={[styles.noted, bodyFont ? { fontFamily: bodyFont } : null]}>{noted}</Text>
          ) : null}
          {error ? (
            <Text style={[styles.error, bodyFont ? { fontFamily: bodyFont } : null]}>{error}</Text>
          ) : null}
        </View>

        {reply ? (
          <View style={styles.reply}>
            <Text style={[styles.replyLabel, bodyFont ? { fontFamily: bodyFont } : null]}>
              {persona === "sage" ? "Sage" : "Scribe"}
            </Text>
            <Text style={[styles.replyBody, bodyFont ? { fontFamily: bodyFont } : null]}>{reply}</Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8D7B8" },
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
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  backCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FF0000",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: {
    color: "#FEFCEB",
    fontSize: 30,
    lineHeight: 32,
    marginTop: -2,
  },
  titleBox: { flex: 1, alignItems: "center" },
  title: {
    color: "#1A1816",
    fontSize: 22,
    letterSpacing: 0.6,
  },
  underline: {
    marginTop: 4,
    height: 1,
    width: 168,
    backgroundColor: "#2E2E2E",
  },
  headerSpacer: { width: 44 },
  scroll: { flex: 1 },
  body: {
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 88,
    gap: 10,
  },
  orbStage: {
    marginTop: 4,
    width: STAGE_W,
    height: STAGE_H,
    alignItems: "center",
    overflow: "visible",
  },
  orbRing: {
    marginTop: 8,
    padding: 6,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: "#BD7F02",
  },
  fire: {
    position: "absolute",
    width: FIRE_W,
    height: FIRE_H,
    left: 0,
    bottom: 22,
    zIndex: 2,
  },
  status: {
    fontSize: 18,
    fontStyle: "italic",
    letterSpacing: 1,
    color: "#4D4D4D",
  },
  pause: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FF0000",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  pauseOff: { opacity: 0.35 },
  pauseBar: {
    width: 4,
    height: 16,
    borderRadius: 2,
    backgroundColor: "#FFFFFF",
  },
  pauseHint: { color: "#6B645C", fontSize: 13 },
  modes: {
    width: "100%",
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  mode: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: "rgba(254,252,235,0.55)",
  },
  modeOn: {
    backgroundColor: "#1A1816",
  },
  modeTitle: { color: "#BD7F02", fontSize: 16 },
  modeBody: { color: "#5A5348", fontSize: 13, marginTop: 2 },
  modeBodyOn: { color: "#F4E6C8" },
  work: {
    width: "100%",
    gap: 8,
    marginTop: 4,
  },
  workLabel: { color: "#1A1816", fontSize: 14 },
  input: {
    width: "100%",
    minHeight: 88,
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 10,
    padding: 12,
    color: "#1A1816",
    fontSize: 16,
    backgroundColor: "rgba(254,252,235,0.8)",
    textAlignVertical: "top",
  },
  button: {
    height: 44,
    borderRadius: 10,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { color: "#FEFCEB", fontSize: 16 },
  noted: { color: "#BD7F02", fontSize: 14 },
  error: { color: "#A33A3A", fontSize: 15 },
  reply: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#BD7F02",
    borderRadius: 10,
    padding: 12,
    backgroundColor: "rgba(254,252,235,0.88)",
    gap: 6,
  },
  replyLabel: { color: "#BD7F02", fontSize: 13 },
  replyBody: { color: "#1A1816", fontSize: 17, lineHeight: 24 },
});
