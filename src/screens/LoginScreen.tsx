import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_400Regular_Italic,
} from "@expo-google-fonts/atkinson-hyperlegible";
import { useAuth } from "../context/AuthContext";
import Rule from "../components/Rule";
import { colors, inkText, useScale } from "../theme";

// 3x art: skull is the Dashboard/Splash dragon; field and social icons from Figma LoginFrame 2601:1443.
const parchment = require("../../assets/images/backgrounds/parchment.png");
const skull = require("../../assets/images/dashboard/skull-dragon.png");
const field = require("../../assets/images/auth/input-field.png"); // Rectangle 30, 291×34 @3x
const googleIcon = require("../../assets/images/auth/icon-google.png");
const facebookIcon = require("../../assets/images/auth/icon-facebook.png");

/** Client-side floor. Supabase Auth also enforces its own minimum in the dashboard (set to 8+). */
const MIN_PASSWORD = 8;

type Mode = "in" | "up";
type Props = { onOpenDash?: () => void };

export default function LoginScreen({ onOpenDash }: Props) {
  const { s, fs, width } = useScale();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [titleW, setTitleW] = useState(200);

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
  });

  const signingUp = mode === "up";
  // Modern stacked layout on a 360-wide Figma frame, scaled like every other screen.
  const formW = Math.min(width - s(56), s(360));
  const skullW = s(signingUp ? 248 : 280);
  const skullH = skullW * (1080 / 994); // skull-dragon@3x aspect
  const fieldH = s(40);
  const btnH = s(44);
  const topInset = Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 24) + s(8) : s(52);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setNotice("");
    setConfirm("");
    setShowPassword(false);
    setShowConfirm(false);
  };

  const submit = async () => {
    setError("");
    setNotice("");
    const trimmed = email.trim();
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (signingUp && password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      if (!signingUp) await signIn(trimmed, password);
      else {
        await signUp(trimmed, password);
        setNotice("Account created. Check your email if Supabase asks you to confirm it.");
        setPassword("");
        setConfirm("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!fontsLoaded) return <View style={styles.fallback} />;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : signingUp ? "height" : undefined}
    >
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.page, { paddingTop: signingUp ? topInset : s(48), paddingBottom: s(36) }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.hero}>
          <Image
            source={skull}
            style={{ width: skullW, height: skullH, marginBottom: signingUp ? s(2) : -skullH * 0.18 }}
            resizeMode="contain"
          />
          <Text
            style={[styles.wordmark, { fontSize: fs(signingUp ? 36 : 34), lineHeight: fs(signingUp ? 44 : 40) }]}
            onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
          >
            Arkane Aid
          </Text>
          <Rule
            width={signingUp ? Math.max(titleW, s(120)) : titleW}
            color={colors.rule}
            style={{ marginTop: s(signingUp ? 4.5 : 5.5), marginBottom: s(signingUp ? 4.5 : 1.5) }}
          />
          {signingUp ? <Text style={[styles.step, { fontSize: fs(15), marginTop: s(10) }]}>Create an account</Text> : null}
        </View>

        <View style={{ width: formW, marginTop: s(signingUp ? 8 : 20) }}>
          <Text style={[styles.label, { fontSize: fs(15), marginBottom: s(4) }]}>
            {signingUp ? "Email" : "Email or mobile"}
          </Text>
          <ImageBackground source={field} resizeMode="stretch" style={[styles.field, { height: fieldH }]}>
            <TextInput
              style={[styles.input, { fontSize: fs(16), height: fieldH, paddingHorizontal: s(14) }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
          </ImageBackground>

          <Text style={[styles.label, { fontSize: fs(15), marginTop: s(10), marginBottom: s(4) }]}>Password</Text>
          <ImageBackground source={field} resizeMode="stretch" style={[styles.field, { height: fieldH }]}>
            <TextInput
              style={[styles.input, { fontSize: fs(16), height: fieldH, paddingHorizontal: s(14), paddingRight: s(64) }]}
              secureTextEntry={!showPassword}
              textContentType={signingUp ? "newPassword" : "password"}
              autoComplete={signingUp ? "password-new" : "password"}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
            />
            <Pressable
              style={[styles.eye, { right: s(12) }]}
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Text style={[styles.eyeText, { fontSize: fs(13) }]}>{showPassword ? "Hide" : "Show"}</Text>
            </Pressable>
          </ImageBackground>

          {signingUp ? (
            <>
              <Text style={[styles.label, { fontSize: fs(15), marginTop: s(10), marginBottom: s(4) }]}>
                Re-enter password
              </Text>
              <ImageBackground source={field} resizeMode="stretch" style={[styles.field, { height: fieldH }]}>
                <TextInput
                  style={[styles.input, { fontSize: fs(16), height: fieldH, paddingHorizontal: s(14), paddingRight: s(64) }]}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  value={confirm}
                  onChangeText={setConfirm}
                  editable={!busy}
                />
                <Pressable
                  style={[styles.eye, { right: s(12) }]}
                  onPress={() => setShowConfirm((v) => !v)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={showConfirm ? "Hide confirmation" : "Show confirmation"}
                >
                  <Text style={[styles.eyeText, { fontSize: fs(13) }]}>{showConfirm ? "Hide" : "Show"}</Text>
                </Pressable>
              </ImageBackground>
            </>
          ) : (
            <Pressable
              onPress={() => {
                setError("");
                setNotice("Password reset is not wired yet.");
              }}
            >
              <Text style={[styles.forgot, { fontSize: fs(13), marginTop: s(6), marginBottom: s(14) }]}>
                Forgot password?
              </Text>
            </Pressable>
          )}

          {error ? (
            <Text style={[styles.error, { fontSize: fs(13), marginTop: s(signingUp ? 12 : 0), marginBottom: s(signingUp ? 0 : 6) }]}>
              {error}
            </Text>
          ) : null}
          {notice ? (
            <Text style={[styles.notice, { fontSize: fs(13), marginTop: s(signingUp ? 12 : 0), marginBottom: s(signingUp ? 0 : 6) }]}>
              {notice}
            </Text>
          ) : null}

          <Pressable
            style={[styles.loginBtn, { height: btnH, marginTop: s(signingUp ? 16 : 0), borderRadius: s(8) }]}
            onPress={submit}
            disabled={busy}
            accessibilityRole="button"
          >
            {busy ? (
              <ActivityIndicator color={colors.cream} />
            ) : (
              <Text style={[styles.loginText, { fontSize: fs(16) }]}>
                {signingUp ? "CREATE ACCOUNT" : "Login"}
              </Text>
            )}
          </Pressable>

          {signingUp ? (
            <Pressable
              style={[styles.signUpBtn, { height: btnH, marginTop: s(10), borderRadius: s(8) }]}
              onPress={() => switchMode("in")}
              disabled={busy}
            >
              <Text style={[styles.signUpText, { fontSize: fs(16) }]}>Back to login</Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.signUpBtn, { height: btnH, marginTop: s(8), borderRadius: s(8) }]}
              onPress={() => switchMode("up")}
              disabled={busy}
            >
              <Text style={[styles.signUpText, { fontSize: fs(16) }]}>Sign up</Text>
            </Pressable>
          )}

          {!signingUp ? (
            <>
              <View style={[styles.orRow, { marginTop: s(14), marginBottom: s(12), gap: s(10) }]}>
                <View style={styles.orLine} />
                <Text style={[styles.or, { fontSize: fs(13) }]}>or</Text>
                <View style={styles.orLine} />
              </View>

              <SocialButton
                icon={googleIcon}
                label="Continue with Google"
                onPress={() => setNotice("Google is not switched on in Supabase yet.")}
                s={s}
                fs={fs}
              />
              <SocialButton
                icon={facebookIcon}
                label="Continue with Facebook"
                onPress={() => setNotice("Facebook is not switched on in Supabase yet.")}
                s={s}
                fs={fs}
              />
            </>
          ) : null}

          {onOpenDash ? (
            <Pressable
              style={[styles.dashBtn, { height: btnH, marginTop: s(6), borderRadius: s(8) }]}
              onPress={onOpenDash}
            >
              <Text style={[styles.dashText, { fontSize: fs(16) }]}>Dashboard</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** Parchment strip with an inked edge — same vibe as the text fields, not a bright brand pill. */
function SocialButton({
  icon,
  label,
  onPress,
  s,
  fs,
}: {
  icon: number;
  label: string;
  onPress: () => void;
  s: (n: number) => number;
  fs: (n: number) => number;
}) {
  const h = s(44);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.social,
        {
          height: h,
          borderRadius: s(8),
          marginBottom: s(8),
          gap: s(10),
          borderWidth: s(1.5),
        },
        pressed && styles.pressed,
      ]}
    >
      <Image source={icon} style={{ width: s(22), height: s(22) }} resizeMode="contain" />
      <Text style={[styles.socialText, { fontSize: fs(15) }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fallback: { flex: 1, backgroundColor: colors.wash },
  root: { flex: 1, backgroundColor: colors.wash },
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
  page: { alignItems: "center" },
  hero: { alignItems: "center" },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: colors.wordmark,
    textAlign: "center",
    ...inkText.red,
  },
  step: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.muted,
  },
  label: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.wordmark,
  },
  field: {
    width: "100%",
    justifyContent: "center",
  },
  input: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.ink,
    paddingVertical: 0,
  },
  eye: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  eyeText: {
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: colors.muted,
  },
  forgot: {
    alignSelf: "flex-end",
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: colors.muted,
  },
  loginBtn: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  loginText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.cream,
    letterSpacing: 0.6,
  },
  signUpBtn: {
    borderWidth: 1.5,
    borderColor: colors.wordmark,
    backgroundColor: "rgba(254,252,235,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  signUpText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.wordmark,
  },
  orRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.ink, opacity: 0.35 },
  or: {
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: colors.muted,
  },
  social: {
    backgroundColor: "rgba(255,246,226,0.92)",
    borderColor: colors.cardStroke,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  socialText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.ink,
  },
  pressed: { opacity: 0.85 },
  dashBtn: {
    borderWidth: 1.5,
    borderColor: colors.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  dashText: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.ink,
  },
  error: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.wordmark,
    textAlign: "center",
  },
  notice: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.muted,
    textAlign: "center",
  },
});
