import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PartyProvider } from "./src/context/PartyContext";
import SplashScreen from "./src/screens/SplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import CodexScreen from "./src/screens/CodexScreen";
import LedgerScreen from "./src/screens/LedgerScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import CreatePartyScreen from "./src/screens/CreatePartyScreen";
import JoinPartyScreen from "./src/screens/JoinPartyScreen";
import TabBar from "./src/components/TabBar";
import type { AppScreen } from "./src/navigation/screens";

const SageScreen = lazy(() => import("./src/screens/SageScreen"));

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

function Gate() {
  const { user, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [screen, setScreen] = useState<AppScreen>("home");

  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), 4200);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    NavigationBar.setBackgroundColorAsync("#000000").catch(() => undefined);
    NavigationBar.setButtonStyleAsync("light").catch(() => undefined);
  }, []);

  if (!splashDone || loading) return <SplashScreen />;
  if (!user) return <LoginScreen />;

  const tabbed = screen === "home" || screen === "sage" || screen === "codex" || screen === "ledger" || screen === "settings";

  return (
    <PartyProvider>
      <View style={styles.root}>
        {screen === "home" ? <HomeScreen onOpen={setScreen} /> : null}
        {screen === "sage" ? (
          <ScreenError onBack={() => setScreen("home")}>
            <Suspense fallback={<View style={styles.root} />}>
              <SageScreen onBack={() => setScreen("home")} />
            </Suspense>
          </ScreenError>
        ) : null}
        {screen === "codex" ? <CodexScreen onBack={() => setScreen("home")} onOpen={setScreen} /> : null}
        {screen === "ledger" ? <LedgerScreen onBack={() => setScreen("home")} onOpen={setScreen} /> : null}
        {screen === "settings" ? <SettingsScreen onBack={() => setScreen("home")} onOpen={setScreen} /> : null}
        {screen === "create" ? (
          <CreatePartyScreen onBack={() => setScreen("settings")} onDone={() => setScreen("settings")} />
        ) : null}
        {screen === "join" ? (
          <JoinPartyScreen onBack={() => setScreen("settings")} onDone={() => setScreen("settings")} />
        ) : null}
        {screen !== "home" ? <TabBar current={screen} onOpen={setScreen} /> : null}
      </View>
    </PartyProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#E8D7B8" },
  error: {
    flex: 1,
    backgroundColor: "#E8D7B8",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 8,
  },
  errorTitle: { color: "#1A1816", fontSize: 18 },
  errorBody: { color: "#5A5348", fontSize: 15, textAlign: "center" },
  errorBack: { color: "#A33A3A", fontSize: 16, marginTop: 12 },
});
