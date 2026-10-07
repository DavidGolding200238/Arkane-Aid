import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_400Regular_Italic,
} from "@expo-google-fonts/atkinson-hyperlegible";
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../context/AuthContext";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Dragon Logo.png");
const underline = require("../../assets/Splash Screen/Rectangle 4901.png");
const field = require("../../assets/Login Screen/Rectangle 30.png");

type Mode = "in" | "up";
type Props = { onOpenDash?: () => void };

export default function LoginScreen({ onOpenDash }: Props) {
  const { width } = useWindowDimensions();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [titleW, setTitleW] = useState(200);

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
  });

  const formW = width - 56;
  const skullW = Math.min(width * 0.62, 280);
  const skullH = skullW * (361 / 333);

  const submit = async (next: Mode) => {
    setError("");
    setNotice("");
    if (!email.includes("@") || password.length < 6) {
      setError("Use a real email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (next === "in") await signIn(email.trim(), password);
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

  if (!fontsLoaded) return <View style={styles.fallback} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.hero}>
          <Image
            source={skull}
            style={{ width: skullW, height: skullH, marginBottom: -skullH * 0.18 }}
            resizeMode="contain"
          />
          <Text
            style={styles.wordmark}
            onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
          >
            Arkane Aid
          </Text>
          <Image source={underline} style={[styles.rule, { width: titleW }]} resizeMode="contain" />
        </View>

        <View style={{ width: formW, marginTop: 22 }}>
          <Text style={styles.label}>Email or mobile</Text>
          <ImageBackground source={field} resizeMode="stretch" style={styles.field}>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </ImageBackground>

          <Text style={[styles.label, { marginTop: 10 }]}>Password</Text>
          <ImageBackground source={field} resizeMode="stretch" style={styles.field}>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </ImageBackground>

          <Pressable
            onPress={() => {
              setError("");
              setNotice("Password reset is not wired yet.");
            }}
          >
            <Text style={styles.forgot}>Forgot password?</Text>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Pressable style={styles.loginBtn} onPress={() => submit("in")} disabled={busy}>
            {busy && mode === "in" ? (
              <ActivityIndicator color="#FEFCEB" />
            ) : (
              <Text style={styles.loginText}>Login</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.signUpBtn}
            onPress={() => {
              setMode("up");
              submit("up");
            }}
            disabled={busy}
          >
            {busy && mode === "up" ? (
              <ActivityIndicator color="#A33A3A" />
            ) : (
              <Text style={styles.signUpText}>Sign up</Text>
            )}
          </Pressable>

          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.or}>or</Text>
            <View style={styles.orLine} />
          </View>

          <Pressable
            style={styles.social}
            onPress={() => setNotice("Google is not switched on in Supabase yet.")}
          >
            <GoogleMark />
            <Text style={styles.socialText}>Continue with Google</Text>
          </Pressable>
          <Pressable
            style={styles.social}
            onPress={() => setNotice("Facebook is not switched on in Supabase yet.")}
          >
            <View style={styles.fb}>
              <Text style={styles.fbText}>f</Text>
            </View>
            <Text style={styles.socialText}>Continue with Facebook</Text>
          </Pressable>

          {onOpenDash ? (
            <Pressable style={styles.dashBtn} onPress={onOpenDash}>
              <Text style={styles.dashText}>Dashboard</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
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
    width: "100%",
    height: "100%",
    opacity: 0.28,
  },
  scroll: { flex: 1, backgroundColor: "transparent" },
  page: {
    alignItems: "center",
    paddingTop: 56,
    paddingBottom: 28,
  },
  hero: { alignItems: "center" },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A33A3A",
    fontSize: 34,
    textAlign: "center",
    opacity: 0.82,
  },
  rule: { height: 8, marginTop: 2 },
  label: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#A33A3A",
    fontSize: 15,
    marginBottom: 4,
  },
  field: {
    width: "100%",
    height: 40,
    justifyContent: "center",
  },
  input: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    paddingHorizontal: 12,
    color: "#1A1816",
    fontSize: 16,
    height: 40,
    paddingVertical: 0,
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: 6,
    marginBottom: 14,
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#5A5348",
    fontSize: 13,
  },
  loginBtn: {
    height: 42,
    borderRadius: 8,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  loginText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#FEFCEB",
    fontSize: 16,
  },
  signUpBtn: {
    marginTop: 8,
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#A33A3A",
    backgroundColor: "rgba(254,252,235,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  signUpText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#A33A3A",
    fontSize: 16,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    marginBottom: 12,
    gap: 10,
  },
  orLine: { flex: 1, height: 1, backgroundColor: "#1A1816", opacity: 0.45 },
  or: {
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#5A5348",
    fontSize: 13,
  },
  social: {
    height: 42,
    borderRadius: 12,
    backgroundColor: "#FFFcf6",
    borderWidth: 1,
    borderColor: "rgba(26,24,22,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginBottom: 8,
  },
  socialText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#1A1816",
    fontSize: 15,
  },
  fb: {
    width: 18,
    height: 18,
    borderRadius: 4,
    backgroundColor: "#1877F2",
    alignItems: "center",
    justifyContent: "center",
  },
  fbText: { color: "#fff", fontSize: 13, fontWeight: "700", marginTop: -1 },
  dashBtn: {
    marginTop: 6,
    height: 42,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: "#1A1816",
    alignItems: "center",
    justifyContent: "center",
  },
  dashText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#1A1816",
    fontSize: 16,
  },
  error: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#A33A3A",
    textAlign: "center",
    marginBottom: 6,
    fontSize: 13,
  },
  notice: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#5A5348",
    textAlign: "center",
    marginBottom: 6,
    fontSize: 13,
  },
});
