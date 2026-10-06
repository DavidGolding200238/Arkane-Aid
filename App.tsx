import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import SplashScreen from "./src/screens/SplashScreen";
import LoginScreen from "./src/screens/LoginScreen";

function Gate() {
  const { user, loading, signOut } = useAuth();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), 4200);
    return () => clearTimeout(id);
  }, []);

  if (!splashDone || loading) return <SplashScreen />;
  if (!user) return <LoginScreen />;

  return (
    <View style={styles.signedIn}>
      <StatusBar style="dark" />
      <Text style={styles.title}>Signed in</Text>
      <Text style={styles.email}>{user.email}</Text>
      <Text style={styles.out} onPress={() => signOut()}>
        Sign out
      </Text>
    </View>
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
  signedIn: {
    flex: 1,
    backgroundColor: "#E8D7B8",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: { fontSize: 28, color: "#1A1816" },
  email: { marginTop: 8, color: "#5A5348", fontSize: 16 },
  out: { marginTop: 24, color: "#BD7F02", fontSize: 16 },
});
