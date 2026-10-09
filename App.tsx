import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { PartyProvider } from "./src/context/PartyContext";
import SplashScreen from "./src/screens/SplashScreen";
import LoginScreen from "./src/screens/LoginScreen";
import HomeScreen from "./src/screens/HomeScreen";
import SageScreen from "./src/screens/SageScreen";
import CodexScreen from "./src/screens/CodexScreen";
import LedgerScreen from "./src/screens/LedgerScreen";
import SettingsScreen from "./src/screens/SettingsScreen";
import CreatePartyScreen from "./src/screens/CreatePartyScreen";
import JoinPartyScreen from "./src/screens/JoinPartyScreen";
import TabBar from "./src/components/TabBar";
import type { AppScreen } from "./src/navigation/screens";

function Gate() {
  const { user, loading } = useAuth();
  const [splashDone, setSplashDone] = useState(false);
  const [screen, setScreen] = useState<AppScreen>("home");

  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), 4200);
    return () => clearTimeout(id);
  }, []);

  if (!splashDone || loading) return <SplashScreen />;
  if (!user) return <LoginScreen />;

  const tabbed = screen === "home" || screen === "sage" || screen === "codex" || screen === "ledger" || screen === "settings";

  return (
    <PartyProvider>
      <View style={styles.root}>
        {screen === "home" ? <HomeScreen onOpen={setScreen} /> : null}
        {screen === "sage" ? <SageScreen onBack={() => setScreen("home")} /> : null}
        {screen === "codex" ? <CodexScreen onBack={() => setScreen("home")} /> : null}
        {screen === "ledger" ? <LedgerScreen onBack={() => setScreen("home")} onOpen={setScreen} /> : null}
        {screen === "settings" ? <SettingsScreen onBack={() => setScreen("home")} onOpen={setScreen} /> : null}
        {screen === "create" ? (
          <CreatePartyScreen onBack={() => setScreen("ledger")} onDone={() => setScreen("ledger")} />
        ) : null}
        {screen === "join" ? (
          <JoinPartyScreen onBack={() => setScreen("ledger")} onDone={() => setScreen("ledger")} />
        ) : null}
        {tabbed && screen !== "home" ? <TabBar current={screen} onOpen={setScreen} /> : null}
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
});
