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
import Svg, { Path } from "react-native-svg";
import { useAuth } from "../context/AuthContext";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Dragon Logo.png");
const field = require("../../assets/Login Screen/Rectangle 30.png");
const line = require("../../assets/Login Screen/Line 28.png");

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

  const [fontsLoaded] = useFonts({ CinzelDecorative_400Regular });

  const formW = Math.min(width - 56, 320);
  const fieldH = formW * (36 / 293);
  const skullW = Math.min(width * 0.62, 250);
  const skullH = skullW * (361 / 333);

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

  if (!fontsLoaded) return <View style={styles.fallback} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={skull}
          style={{ width: skullW, height: skullH, marginTop: 12 }}
          resizeMode="contain"
        />

        <Text style={styles.wordmark}>ARKANE AID</Text>
        <View style={styles.titleRule} />

        <View style={{ width: formW, marginTop: 28 }}>
          <Text style={styles.label}>Email or Mobile</Text>
          <ImageBackground
            source={field}
            resizeMode="stretch"
            style={[styles.field, { height: fieldH }]}
          >
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </ImageBackground>

          <Text style={[styles.label, { marginTop: 14 }]}>Password</Text>
          <ImageBackground
            source={field}
            resizeMode="stretch"
            style={[styles.field, { height: fieldH }]}
          >
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
            <Text style={styles.forgot}>Forgot Password ?</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable style={styles.loginBtn} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#FEFCEB" />
          ) : (
            <Text style={styles.loginText}>{mode === "in" ? "LOGIN" : "SIGN UP"}</Text>
          )}
        </Pressable>

        <View style={[styles.orRow, { width: formW }]}>
          <Image source={line} style={styles.orLine} resizeMode="stretch" />
          <Text style={styles.or}>OR</Text>
          <Image source={line} style={styles.orLine} resizeMode="stretch" />
        </View>

        <View style={styles.socialRow}>
          <Pressable
            style={styles.social}
            onPress={() => setNotice("Google is not switched on in Supabase yet.")}
          >
            <GoogleMark />
          </Pressable>
          <Pressable
            style={styles.social}
            onPress={() => setNotice("Facebook is not switched on in Supabase yet.")}
          >
            <View style={styles.fb}>
              <Text style={styles.fbText}>f</Text>
            </View>
          </Pressable>
        </View>

        <Pressable onPress={() => setMode(mode === "in" ? "up" : "in")}>
          <Text style={styles.switch}>
            {mode === "in" ? "Sign up" : "Back to login"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function GoogleMark() {
  return (
    <Svg width={28} height={28} viewBox="0 0 48 48">
      <Path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z" />
      <Path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z" />
      <Path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <Path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.2l6.3 5.3C37.4 38.3 44 33 44 24c0-1.3-.1-2.7-.4-3.5z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: "#F3E6D0" },
  root: { flex: 1, backgroundColor: "#F3E6D0" },
  parchment: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    opacity: 0.45,
  },
  scroll: {
    alignItems: "center",
    paddingBottom: 36,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A4161A",
    fontSize: 28,
    letterSpacing: 1,
    marginTop: 4,
  },
  titleRule: {
    width: 168,
    height: 1.5,
    backgroundColor: "#A4161A",
    marginTop: 2,
  },
  label: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A4161A",
    fontSize: 16,
    marginBottom: 6,
  },
  field: {
    width: "100%",
    justifyContent: "center",
  },
  input: {
    paddingHorizontal: 12,
    color: "#1A1816",
    fontSize: 16,
    paddingVertical: 0,
  },
  forgot: {
    alignSelf: "flex-end",
    marginTop: 8,
    color: "#1A1816",
    fontSize: 12,
    textDecorationLine: "underline",
  },
  loginBtn: {
    marginTop: 22,
    width: 156,
    height: 42,
    borderRadius: 6,
    backgroundColor: "#C44536",
    alignItems: "center",
    justifyContent: "center",
  },
  loginText: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#FEFCEB",
    fontSize: 16,
    letterSpacing: 1,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 26,
    gap: 10,
  },
  orLine: { flex: 1, height: 3 },
  or: {
    color: "#1A1816",
    fontSize: 12,
    letterSpacing: 1,
  },
  socialRow: {
    flexDirection: "row",
    gap: 28,
    marginTop: 18,
  },
  social: {
    width: 58,
    height: 58,
    borderRadius: 8,
    backgroundColor: "#FFFcf6",
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
  },
  fb: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: "#1877F2",
    alignItems: "center",
    justifyContent: "center",
  },
  fbText: { color: "#fff", fontSize: 24, fontWeight: "700", marginTop: -2 },
  switch: {
    marginTop: 16,
    color: "#A4161A",
    fontSize: 13,
    textDecorationLine: "underline",
  },
  error: { color: "#A4161A", textAlign: "center", marginTop: 10, paddingHorizontal: 24 },
  notice: { color: "#5A5348", textAlign: "center", marginTop: 8, paddingHorizontal: 24 },
});
