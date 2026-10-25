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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import PageFade, { useFadeSizes } from "../components/PageFade";
import Rule from "../components/Rule";
import TornButton, { FineEdgeArt } from "../components/TornButton";
import { colors, fonts, inkText, useAppFonts, useScale } from "../theme";

const parchment = require("../../assets/images/backgrounds/parchment.png");
const skull = require("../../assets/images/dashboard/skull-dragon.png");
const field = require("../../assets/images/auth/input-field.png");

// Same rule as sign-up.
const MIN_PASSWORD = 8;
const LINK_ERROR = "That reset link is invalid or has expired. Send a new link and try again.";

type Props = { onBack: () => void; onDone: () => void };

/**
 * Reset password with the emailed link, styled like Create Account. Step 1 sends the link; tapping
 * it on this phone reopens the app here (see AuthContext) for step 2, the new password.
 */
export default function ResetPasswordScreen({ onBack, onDone }: Props) {
  const { s, fs, width } = useScale();
  const { recovery, sendResetLink, saveNewPassword } = useAuth();
  const linkOpened = recovery === "ready";
  const [email, setEmail] = useState("");
  const [linkErrorSeen, setLinkErrorSeen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [titleW, setTitleW] = useState(200);
  const fade = useFadeSizes();
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState({ w: 0, h: 0 });
  // Scroll area, for the Sage bottom fade (it shrinks while the keyboard is open).
  const [scrollBox, setScrollBox] = useState({ y: 0, h: 0 });
  const fontsLoaded = useAppFonts();

  const formW = Math.min(width - s(56), s(360));
  const skullW = s(248);
  const skullH = skullW * (1080 / 994);
  const fieldH = s(40);
  const btnH = s(40);
  // The button lines up with the input boxes' edges, as on Login/Sign up.
  const socialW = formW;
  const topInset = Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 24) + s(8) : s(52);
  const locked = busy || sending;

  const validEmail = () => {
    const trimmed = email.trim();
    if (!trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Enter a valid email address.");
      return "";
    }
    return trimmed;
  };

  const sendLink = async () => {
    setError("");
    setNotice("");
    setLinkErrorSeen(true);
    const trimmed = validEmail();
    if (!trimmed) return;
    setSending(true);
    try {
      await sendResetLink(trimmed);
      setNotice("If that email has an account, a reset link is on its way. Open the email on this phone and tap the link.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setSending(false);
    }
  };

  const submit = async () => {
    setError("");
    setNotice("");
    if (password.length < MIN_PASSWORD) {
      setError(`Password must be at least ${MIN_PASSWORD} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await saveNewPassword(password);
      // Signed in with the new password; next time the signed-out page opens on Login.
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  if (!fontsLoaded) return <View style={styles.fallback} />;

  // Same bottom fade as Login/Sign up: solid paper behind the nav bar, then one line fading up.
  const keyboardOpen = screen.h > 0 && scrollBox.h > 0 && scrollBox.y + scrollBox.h < screen.h - 1;
  const shownError = error || (recovery === "invalid" && !linkErrorSeen ? LINK_ERROR : "");
  const navCover = keyboardOpen ? 0 : insets.bottom;
  const bottomFadeH = navCover + fade.line;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior="padding"
      onLayout={(e) => setScreen({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
    >
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.page, { paddingTop: Math.max(topInset, insets.top + fade.tail), paddingBottom: Math.max(s(36), insets.bottom) + fade.line }]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
        onLayout={(e) => setScrollBox({ y: e.nativeEvent.layout.y, h: e.nativeEvent.layout.height })}
      >
        <View style={styles.hero}>
          <Image source={skull} style={{ width: skullW, height: skullH, marginBottom: s(2) }} resizeMode="contain" />
          <Text
            style={[styles.wordmark, { fontSize: fs(36), lineHeight: fs(36), includeFontPadding: false }]}
            onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
          >
            Arkane Aid
          </Text>
          <Rule width={Math.max(titleW, s(120))} color={colors.rule} style={{ marginTop: -s(4), marginBottom: s(4) }} />
          <Text style={[styles.step, { fontSize: fs(15), marginTop: s(8) }]} accessibilityRole="header">
            {linkOpened ? "Choose a new password" : "Reset your password"}
          </Text>
        </View>

        <View style={{ width: formW, marginTop: s(8) }}>
          {linkOpened ? (
            <>
              <Text style={[styles.label, { fontSize: fs(15), marginBottom: s(4) }]}>New password</Text>
              <FieldBox height={fieldH} width={formW} seed={13}>
                <TextInput
                  style={[styles.input, { fontSize: fs(16), height: fieldH, paddingHorizontal: s(14), paddingRight: s(64) }]}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoComplete="password-new"
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

              <Text style={[styles.label, { fontSize: fs(15), marginTop: s(10), marginBottom: s(4) }]}>Re-enter new password</Text>
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
            <>
              <Text style={[styles.label, { fontSize: fs(15), marginBottom: s(4) }]}>Email</Text>
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
                  editable={!locked}
                  placeholderTextColor={colors.placeholder}
                />
              </FieldBox>
            </>
          )}

          {shownError ? <Text style={[styles.error, { fontSize: fs(13), marginTop: s(12) }]}>{shownError}</Text> : null}
          {notice ? <Text style={[styles.notice, { fontSize: fs(13), marginTop: s(12) }]}>{notice}</Text> : null}

          <View style={{ marginTop: s(16), alignItems: "center", gap: s(10) }}>
            <TornButton
              label={linkOpened ? "Save new password" : "Send reset link"}
              variant="red"
              fullWidth={socialW}
              height={btnH}
              compact
              fineEdge
              onPress={linkOpened ? submit : sendLink}
              busy={linkOpened ? busy : sending}
              disabled={locked}
            />
            <Pressable onPress={onBack} disabled={busy} hitSlop={8} accessibilityRole="button" accessibilityLabel="Back to login">
              <Text style={[styles.backLink, { fontSize: fs(14) }]}>Back to login</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>
      {/* Same top fade as Sign up: solid paper behind the status bar, then Sage's short tail. */}
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

/** Parchment field, as on Login: the paper art with one fine ink line for its border. */
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
    fontFamily: fonts.title,
    color: colors.wordmark,
    textAlign: "center",
    ...inkText.red,
  },
  step: { fontFamily: fonts.body, color: colors.muted },
  label: { fontFamily: fonts.body, color: colors.wordmark },
  input: {
    fontFamily: fonts.body,
    color: colors.ink,
    paddingVertical: 0,
    backgroundColor: "transparent",
  },
  eye: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  eyeText: { fontFamily: fonts.bodyItalic, color: colors.muted },
  backLink: {
    fontFamily: fonts.body,
    color: colors.wordmark,
    textAlign: "center",
    textDecorationLine: "underline",
  },
  error: { fontFamily: fonts.body, color: colors.wordmark, textAlign: "center" },
  notice: { fontFamily: fonts.body, color: colors.muted, textAlign: "center" },
});
