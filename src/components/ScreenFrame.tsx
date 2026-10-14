import type { ReactNode } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");

type Props = {
  title: string;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export default function ScreenFrame({ title, onBack, children, footer }: Props) {
  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular,
  });

  if (!fontsLoaded) return <View style={styles.fallback} />;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />
      <View style={styles.bar}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>Back</Text>
        </Pressable>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.spacer} />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
      >
        {children}
      </ScrollView>
      {footer}
    </View>
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
  bar: {
    paddingTop: 52,
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  back: {
    fontFamily: "AtkinsonHyperlegible_400Regular",
    color: "#A33A3A",
    fontSize: 16,
    width: 56,
  },
  title: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#1A1816",
    fontSize: 22,
  },
  spacer: { width: 56 },
  body: { paddingHorizontal: 20, paddingBottom: 96, gap: 12 },
});
