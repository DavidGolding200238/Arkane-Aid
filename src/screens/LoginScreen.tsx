import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../context/AuthContext";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Ark3 3.png");
const d20 = require("../../assets/Splash Screen/Group 5947.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");

type Mode = "in" | "up";

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [titleW, setTitleW] = useState(180);

  const [fontsLoaded] = useFonts({ CinzelDecorative_400Regular });

  const skullW = Math.min(width * 0.46, 190);
  const skullH = skullW;
  const dieW = skullW * 0.4;
  const dieH = dieW * 0.9;

  const submit = async () => {
    setError("");
    setNotice("");
    if (!email.includes("@") || password.length < 6) {
      setError("Use a real email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "in") await signIn(email.trim(), password);
      else {
        await signUp(email.trim(), password);
        setNotice("Account created. Confirm the email if Supabase still asks for it.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auth failed.");
    } finally {
      setBusy(false);
    }
  };

  const social = (name: string) => {
    setError("");
    setNotice(`${name} is on the screen. The provider is not switched on in Supabase yet.`);
  };

  if (!fontsLoaded) return <View style={styles.fallback} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={styles.column}>
        <View style={{ width: skullW, height: skullH, marginTop: 28 }}>
          <Image source={skull} style={{ width: skullW, height: skullH }} resizeMode="contain" />
          <Image
            source={d20}
            style={{
              position: "absolute",
              width: dieW,
              height: dieH,
              left: (skullW - dieW) / 2,
              top: skullH * 0.35,
            }}
            resizeMode="contain"
          />
        </View>

        <Text
          style={styles.wordmark}
          onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
        >
          Arkane Aid
        </Text>
        <Image source={underline} style={[styles.rule, { width: titleW }]} resizeMode="contain" />

        <View style={styles.tabs}>
          <Pressable onPress={() => setMode("in")} style={styles.tab}>
            <Text style={[styles.tabText, mode === "in" && styles.tabActive]}>LOGIN</Text>
            {mode === "in" ? <View style={styles.tabLine} /> : <View style={styles.tabGap} />}
          </Pressable>
          <Pressable onPress={() => setMode("up")} style={styles.tab}>
            <Text style={[styles.tabText, mode === "up" && styles.tabActive]}>SIGN UP</Text>
            {mode === "up" ? <View style={styles.tabLine} /> : <View style={styles.tabGap} />}
          </Pressable>
        </View>

        <Text style={styles.label}>EMAIL</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable style={styles.loginBtn} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#1A1816" />
          ) : (
            <Text style={styles.loginText}>{mode === "in" ? "LOGIN" : "SIGN UP"}</Text>
          )}
        </Pressable>

        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.or}>OR</Text>
          <View style={styles.orLine} />
        </View>

        <Pressable style={styles.social} onPress={() => social("Google")}>
          <GoogleMark />
          <Text style={styles.socialText}>Continue with Google</Text>
        </Pressable>
        <Pressable style={styles.social} onPress={() => social("Facebook")}>
          <View style={styles.fb}>
            <Text style={styles.fbText}>f</Text>
          </View>
          <Text style={styles.socialText}>Continue with Facebook</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.2l6.3 5.3C37.4 38.3 44 33 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: "#E8D7B8" },
  root: { flex: 1, backgroundColor: "#E8D7B8" },
  parchment: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.28,
  },
  column: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingBottom: 28,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A33A3A",
    fontSize: 32,
    marginTop: -8,
    textAlign: "center",
  },
  rule: { height: 10, marginTop: 2, marginBottom: 18 },
  tabs: {
    flexDirection: "row",
    gap: 36,
    marginBottom: 22,
  },
  tab: { alignItems: "center" },
  tabText: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#1A1816",
    fontSize: 16,
    letterSpacing: 1,
    opacity: 0.55,
  },
  tabActive: { opacity: 1 },
  tabLine: {
    marginTop: 4,
    height: 2,
    width: "100%",
    backgroundColor: "#1A1816",
  },
  tabGap: { marginTop: 4, height: 2 },
  label: {
    alignSelf: "stretch",
    fontFamily: "CinzelDecorative_400Regular",
    color: "#BD7F02",
    fontSize: 12,
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  input: {
    alignSelf: "stretch",
    borderBottomWidth: 1,
    borderBottomColor: "#1A1816",
    color: "#1A1816",
    fontSize: 16,
    paddingVertical: 6,
    marginBottom: 16,
  },
  loginBtn: {
    marginTop: 8,
    minWidth: 148,
    minHeight: 36,
    paddingHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#1A1816",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  loginText: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#1A1816",
    fontSize: 14,
    letterSpacing: 1,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "stretch",
    marginTop: 22,
    marginBottom: 16,
    gap: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "#1A1816", opacity: 0.7 },
  or: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#1A1816",
    fontSize: 12,
    letterSpacing: 1,
  },
  social: {
    alignSelf: "stretch",
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: "#1A1816",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 12,
    backgroundColor: "rgba(254,252,235,0.35)",
  },
  socialText: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#1A1816",
    fontSize: 13,
  },
  fb: {
    width: 18,
    height: 18,
    borderRadius: 3,
    backgroundColor: "#1877F2",
    alignItems: "center",
    justifyContent: "center",
  },
  fbText: { color: "#fff", fontSize: 14, fontWeight: "700", marginTop: -1 },
  error: { color: "#FF0000", textAlign: "center", marginBottom: 8, fontSize: 13 },
  notice: { color: "#5A5348", textAlign: "center", marginBottom: 8, fontSize: 13 },
});
