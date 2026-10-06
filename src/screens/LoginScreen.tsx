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
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";
import { useAuth } from "../context/AuthContext";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
  });

  const submit = async () => {
    setError("");
    setNotice("");
    if (!email.includes("@") || password.length < 6) {
      setError("Use a real email and a password of at least 6 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "in") {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
        setNotice("Account created. If confirm email is on, check the inbox before signing in.");
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
      <View style={styles.column}>
        <Text style={styles.wordmark}>Arkane Aid</Text>
        <Text style={styles.caption}>
          {mode === "in" ? "Sign in to the table." : "Make an account."}
        </Text>

        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="Email"
          placeholderTextColor="#8A8175"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          style={styles.input}
          secureTextEntry
          placeholder="Password"
          placeholderTextColor="#8A8175"
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable style={styles.button} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#FEFCEB" />
          ) : (
            <Text style={styles.buttonText}>{mode === "in" ? "Sign in" : "Sign up"}</Text>
          )}
        </Pressable>

        <Pressable onPress={() => setMode(mode === "in" ? "up" : "in")}>
          <Text style={styles.switch}>
            {mode === "in" ? "Need an account? Sign up" : "Already have one? Sign in"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
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
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A33A3A",
    fontSize: 36,
    textAlign: "center",
  },
  caption: {
    marginTop: 8,
    marginBottom: 28,
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#5A5348",
    fontSize: 16,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#FEFCEB",
    borderWidth: 1,
    borderColor: "#1A1816",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
    color: "#1A1816",
  },
  button: {
    marginTop: 8,
    backgroundColor: "#1A1816",
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#FEFCEB",
    fontSize: 16,
  },
  switch: {
    marginTop: 18,
    textAlign: "center",
    color: "#BD7F02",
    fontFamily: "AtkinsonHyperlegible_400Regular",
    fontSize: 15,
  },
  error: {
    color: "#FF0000",
    marginBottom: 8,
    textAlign: "center",
  },
  notice: {
    color: "#5A5348",
    marginBottom: 8,
    textAlign: "center",
  },
});
