import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { BackHandler, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PartyProvider } from "./src/context/PartyContext";
import { VoiceProvider } from "./src/context/VoiceContext";
import SplashScreen from "./src/screens/SplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CodexScreen from "./src/screens/CodexScreen";
import LedgerScreen from "./src/screens/LedgerScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import CreatePartyScreen from "./src/screens/CreatePartyScreen";
import JoinPartyScreen from "./src/screens/JoinPartyScreen";
import TabBar from "./src/components/TabBar";
import { GuidancePopup } from "./src/components/Guidance";
import type { AppScreen } from "./src/navigation/screens";
import type { Character } from "./src/lib/character";
import { colors } from "./src/theme";
import { loadedSageScreen, loadSageScreen, runPreload } from "./src/lib/preload";

const LazySageScreen = lazy(loadSageScreen);

// The splash normally loads the Sage's code before anyone can tap it, so it opens straight
// away. If it isn't loaded yet (the preload timed out), fall back to loading it here.
function SageEntry(props: { onBack: () => void; onOpenTome: () => void }) {
  const Loaded = loadedSageScreen();
  // The loaded screen is a module-level component cached by preload, not one created here.
  // eslint-disable-next-line react-hooks/static-components
  if (Loaded) return <Loaded {...props} />;
  return (
    <Suspense fallback={<SageLoading />}>
      <LazySageScreen {...props} />
    </Suspense>
  );
}

function SageLoading() {
  return (
    <View style={styles.error}>
      <Text style={styles.errorBody}>The Sage stirs{"\u2026"}</Text>
    </View>
  );
}

const MIN_SPLASH_MS = 1200; // long enough to read the splash, never just a flash
const PRELOAD_TIMEOUT_MS = 15000; // never stuck on the splash

class ScreenError extends Component<{ children: ReactNode; onBack: () => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={styles.error}>
        <Text style={styles.errorTitle}>The Sage could not open.</Text>
        <Text style={styles.errorBody}>The rest of the table is still here.</Text>
        <Text style={styles.errorBack} onPress={this.props.onBack}>
          Back to the dashboard
        </Text>
      </View>
    );
  }
}

// Where each screen's back arrow goes; Android's own back button and gesture follow the same map.
function backFrom(screen: AppScreen): AppScreen {
  if (screen === "ledger" || screen === "retired") return "codex";
  if (screen === "create" || screen === "join") return "settings";
  return "home";
}

function Gate() {
  const { user, loading, recovery, cancelRecovery } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [progress, setProgress] = useState(0);
  const [preloaded, setPreloaded] = useState(false);
  const [screen, setScreen] = useState<AppScreen>("home");
  // The retired sheet open read-only, and whether the Codex reopens on its Archive tab (coming
  // back from that sheet). Any other way into the Codex opens it as usual.
  const [retired, setRetired] = useState<Character | null>(null);
  const [codexTab, setCodexTab] = useState<"archive" | undefined>(undefined);
  const open = useCallback((next: AppScreen) => {
    setCodexTab(undefined);
    setScreen(next);
  }, []);
  const [resetting, setResetting] = useState(false);

  // The splash waits for real work: fonts, the main screens' art, the fire loops, and the Sage's
  // code and orb model, reporting progress as each finishes (see src/lib/preload).
  useEffect(() => {
    let live = true;
    const minimum = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
    Promise.all([runPreload((p) => live && setProgress(p), PRELOAD_TIMEOUT_MS), minimum]).then(() => {
      if (live) setPreloaded(true);
    });
    return () => {
      live = false;
    };
  }, []);

  // Android back (the < key or the side swipe) goes back a page like the on-screen arrows.
  // On the dashboard and the login screen it is left to Android, which closes the app.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!splashDone || loading) return false;
      if (!user) {
        if (resetting || recovery !== "none") {
          setResetting(false);
          void cancelRecovery();
          return true;
        }
        return false;
      }
      if (screen === "home") return false;
      setScreen(backFrom(screen));
      return true;
    });
    return () => sub.remove();
  }, [splashDone, loading, user, resetting, recovery, cancelRecovery, screen]);

  const finishSplash = useCallback(() => setSplashDone(true), []);

  if (!splashDone || loading) {
    return <SplashScreen progress={progress} ready={preloaded} onFinish={finishSplash} />;
  }
  if (!user) {
    // A reset link opens the reset screen on its own, even from a cold start.
    if (resetting || recovery !== "none") {
      return (
        <ResetPasswordScreen
          onBack={() => {
            setResetting(false);
            void cancelRecovery();
          }}
          onDone={() => setResetting(false)}
        />
      );
    }
    return <LoginScreen onForgotPassword={() => setResetting(true)} />;
  }


  return (
    <PartyProvider>
      <View style={styles.root}>
        {screen === "home" ? <HomeScreen onOpen={open} /> : null}
        {screen === "sage" ? (
          <ScreenError onBack={() => setScreen("home")}>
            <SageEntry onBack={() => setScreen("home")} onOpenTome={() => setScreen("settings")} />
          </ScreenError>
        ) : null}
        {screen === "codex" ? (
          <CodexScreen
            onBack={() => open("home")}
            onOpen={open}
            initialTab={codexTab}
            onViewRetired={(character) => {
              setRetired(character);
              setCodexTab("archive");
              setScreen("retired");
            }}
          />
        ) : null}
        {screen === "ledger" ? <LedgerScreen onBack={() => open(backFrom("ledger"))} onOpen={open} /> : null}
        {screen === "retired" && retired ? (
          <LedgerScreen retired={retired} onBack={() => setScreen("codex")} onOpen={open} />
        ) : null}
        {screen === "settings" ? <SettingsScreen onBack={() => open("home")} onOpen={open} /> : null}
        {screen === "create" ? (
          <CreatePartyScreen onBack={() => setScreen("settings")} onDone={() => setScreen("settings")} />
        ) : null}
        {screen === "join" ? (
          <JoinPartyScreen onBack={() => setScreen("settings")} onDone={() => setScreen("settings")} />
        ) : null}
        {/* Every page, the dashboard too, sits above the tab bar (never under it). */}
        <TabBar current={screen} onOpen={open} />
        {/* The how-to tips, once per account on this phone (keyed so a new sign-in checks again). */}
        <GuidancePopup key={user.id} userId={user.id} />
      </View>
    </PartyProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <VoiceProvider>
          <Gate />
        </VoiceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.wash },
  error: {
    flex: 1,
    backgroundColor: colors.wash,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
  },
  errorTitle: { color: colors.ink, fontSize: 18 },
  errorBody: { color: colors.muted, fontSize: 15, textAlign: "center" },
  errorBack: { color: colors.wordmark, fontSize: 16, marginTop: 12 },
});
