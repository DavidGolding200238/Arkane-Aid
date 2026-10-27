import { useState, type ReactNode } from "react";
import {
  Image,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import PageFade, { useFadeSizes } from "../components/PageFade";
import Rule from "../components/Rule";
import TornButton, { FineEdgeArt } from "../components/TornButton";
import { colors, inkText, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
const skull = require("../../assets/images/dashboard/skull-dragon.png");
const field = require("../../assets/images/auth/input-field.png");
const googleIcon = require("../../assets/images/auth/icon-google.png");
const facebookIcon = require("../../assets/images/auth/icon-facebook.png");

const MIN_PASSWORD = 8;

type Mode = "in" | "up";
type Props = { onOpenDash?: () => void; onForgotPassword?: () => void };

export default function LoginScreen({ onOpenDash, onForgotPassword }: Props) {
  const { s, fs, width } = useScale();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<Mode>("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [titleW, setTitleW] = useState(200);
  // Layout for the Sage page's top fade behind the status bar.
  const fade = useFadeSizes();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  // Scroll area, for the Sage bottom fade (it shrinks while the keyboard is open).
  const [scrollBox, setScrollBox] = useState({ y: 0, h: 0 });

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
  });

  const signingUp = mode === "up";
  const formW = Math.min(width - s(56), s(360));
  const skullW = s(signingUp ? 248 : 280);
  const skullH = skullW * (1080 / 994);
  const fieldH = s(40);
  // Compact auth: buttons hug their labels (~40 dp art, hit area padded to 44 by TornButton).
  const btnH = s(40);
  // Every button lines up with the input boxes' left and right edges (formW).
  const pairGap = s(12);
  const pairW = (formW - pairGap) / 2; // Login | Sign up split the field width, both equal
  const socialW = formW;
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

  const google = async () => {
    setError("");
    setNotice("");
    setGoogleBusy(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setGoogleBusy(false);
    }
  };

  if (!fontsLoaded) return <View style={styles.fallback} />;

  // Sage's bottom fade: solid paper behind the nav bar, then one line fading up from it. With the
  // keyboard open the scroll area ends at the keyboard, so there is no nav bar to cover.
  const keyboardOpen = screen.h > 0 && scrollBox.h > 0 && scrollBox.y + scrollBox.h < screen.h - 1;
  const navCover = keyboardOpen ? 0 : insets.bottom;
  const bottomFadeH = navCover + fade.line;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      // Same as Sage: padding on both platforms, so the form pushes up above the keyboard.
      behavior="padding"
      onLayout={(e) => setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.page, { paddingTop: signingUp ? Math.max(topInset, insets.top + fade.tail) : s(48), paddingBottom: Math.max(s(36), insets.bottom) + fade.line }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        onLayout={(e) => setScrollBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
      >
        <View style={styles.hero}>
          <Image
            source={skull}
            style={{ width: skullW, height: skullH, marginBottom: signingUp ? s(2) : -skullH * 0.18 }}
            resizeMode="contain"
          />
          <Text
            style={[
              styles.wordmark,
              {
                fontSize: fs(signingUp ? 36 : 34),
                lineHeight: fs(signingUp ? 36 : 34),
                includeFontPadding: false,
              },
            ]}
            onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
          >
            Arkane Aid
          </Text>
          {/* Snug under the letters, same as PageHeader (no large gap). */}
          <Rule
            width={signingUp ? Math.max(titleW, s(120)) : titleW}
            color={colors.rule}
            style={{ marginTop: -s(4), marginBottom: s(signingUp ? 4 : 2) }}
          />
          {signingUp ? <Text style={[styles.step, { fontSize: fs(15), marginTop: s(8) }]}>Create an account</Text> : null}
        </View>

        <View style={{ width: formW, marginTop: s(signingUp ? 8 : 20) }}>
          <Text style={[styles.label, { fontSize: fs(15), marginBottom: s(4) }]}>
            {signingUp ? "Email" : "Email or mobile"}
          </Text>
          <FieldBox height={fieldH} width={formW} seed={12}>
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
              placeholderTextColor={colors.placeholder}
            />
          </FieldBox>

          <Text style={[styles.label, { fontSize: fs(15), marginTop: s(10), marginBottom: s(4) }]}>Password</Text>
          <FieldBox height={fieldH} width={formW} seed={13}>
            <TextInput
              style={[styles.input, { fontSize: fs(16), height: fieldH, paddingHorizontal: s(14), paddingRight: s(64) }]}
              secureTextEntry={!showPassword}
              textContentType={signingUp ? "newPassword" : "password"}
              autoComplete={signingUp ? "password-new" : "password"}
              value={password}
              onChangeText={setPassword}
              editable={!busy}
              placeholderTextColor={colors.placeholder}
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
          </FieldBox>

          {signingUp ? (
            <>
              <Text style={[styles.label, { fontSize: fs(15), marginTop: s(10), marginBottom: s(4) }]}>
                Re-enter password
              </Text>
              <FieldBox height={fieldH} width={formW} seed={14}>
                <TextInput
                  style={[styles.input, { fontSize: fs(16), height: fieldH, paddingHorizontal: s(14), paddingRight: s(64) }]}
                  secureTextEntry={!showConfirm}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  value={confirm}
                  onChangeText={setConfirm}
                  editable={!busy}
                  placeholderTextColor={colors.placeholder}
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
              </FieldBox>
            </>
          ) : (
            <Pressable
              onPress={() => {
                if (onForgotPassword) return onForgotPassword();
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

          {/* Compact auth actions: ~44–48 dp tall, Login|Sign up in one row on login. */}
          {signingUp ? (
            <View style={{ marginTop: s(16), alignItems: "center", gap: s(10) }}>
              <TornButton
                label="Create account"
                variant="red"
                fullWidth={socialW}
                height={btnH}
                compact
                fineEdge
                onPress={submit}
                busy={busy}
                disabled={busy}
              />
              <Pressable
                onPress={() => switchMode("in")}
                disabled={busy}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back to login"
              >
                <Text style={[styles.backLink, { fontSize: fs(14) }]}>Back to login</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={{ marginTop: s(8), flexDirection: "row", justifyContent: "center", gap: pairGap }}>
                <TornButton label="Login" variant="red" fullWidth={pairW} height={btnH} compact fineEdge onPress={submit} busy={busy} disabled={busy} />
                <TornButton
                  label="Sign up"
                  variant="parchment"
                  fullWidth={pairW}
                  height={btnH}
                  compact
                  fineEdge
                  onPress={() => switchMode("up")}
                  disabled={busy}
                />
              </View>

              <View style={[styles.orRow, { marginTop: s(14), marginBottom: s(10), gap: s(10) }]}>
                <View style={styles.orLine} />
                <Text style={[styles.or, { fontSize: fs(13) }]}>or</Text>
                <View style={styles.orLine} />
              </View>

              <View style={{ alignItems: "center", gap: s(8) }}>
                <TornButton
                  label="Continue with Google"
                  variant="parchment"
                  fullWidth={socialW}
                  height={btnH}
                  compact
                  fineEdge
                  icon={googleIcon}
                  onPress={google}
                  busy={googleBusy}
                  disabled={busy || googleBusy}
                />
                <TornButton
                  label="Continue with Facebook"
                  variant="parchment"
                  fullWidth={socialW}
                  height={btnH}
                  compact
                  fineEdge
                  icon={facebookIcon}
                  onPress={() => setNotice("Facebook is not switched on in Supabase yet.")}
                />
              </View>
            </>
          )}

          {onOpenDash ? (
            <View style={{ marginTop: s(10), alignItems: "center" }}>
              <TornButton label="Dashboard" variant="parchment" fullWidth={formW} height={btnH} compact fineEdge onPress={onOpenDash} />
            </View>
          ) : null}
        </View>
      </ScrollView>
      {/* The Sage page's top fade: solid paper behind the status bar, then Sage's short tail, so the
          page scrolls away under it instead of under the clock and icons. */}
      <PageFade
        direction="down"
        top={0}
        height={insets.top + fade.tail}
        solid={insets.top / (insets.top + fade.tail)}
        screenWidth={screen.w}
        screenHeight={screen.h}
      />
      {scrollBox.h > 0 && screen.h > 0 ? (
        <PageFade
          direction="up"
          top={scrollBox.y + scrollBox.h - bottomFadeH}
          height={bottomFadeH}
          solid={navCover / bottomFadeH}
          screenWidth={screen.w}
          screenHeight={screen.h}
        />
      ) : null}
    </KeyboardAvoidingView>
  );
}

/** Parchment field: the same paper art, its heavy torn border swapped for one fine ink line. */
function FieldBox({ height, width, seed, children }: { height: number; width: number; seed: number; children: ReactNode }) {
  return (
    <View style={{ width: "100%", height, backgroundColor: "transparent", overflow: "visible" }}>
      <FineEdgeArt source={field} w={width} h={height} seed={seed} />
      {children}
    </View>
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
  step: { fontFamily: "AtkinsonHyperlegible_400Regular", color: colors.muted },
  label: { fontFamily: "AtkinsonHyperlegible_400Regular", color: colors.wordmark },
  input: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.ink,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  eye: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  eyeText: { fontFamily: "AtkinsonHyperlegible_400Regular_Italic", color: colors.muted },
  forgot: {
    alignSelf: "flex-end",
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: colors.muted,
  },
  backLink: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: colors.wordmark,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  orRow: { flexDirection: "row", alignItems: "center" },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth * 2, backgroundColor: colors.ink, opacity: 0.35 },
  or: { fontFamily: "AtkinsonHyperlegible_400Regular_Italic", color: colors.muted },
  error: { fontFamily: "AtkinsonHyperlegible_400Regular", color: colors.wordmark, textAlign: "center" },
  notice: { fontFamily: "AtkinsonHyperlegible_400Regular", color: colors.muted, textAlign: "center" },
});
