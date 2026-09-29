import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { CinzelDecorative_400Regular } from "@expo-google-fonts/cinzel-decorative";
import { AtkinsonHyperlegible_400Regular_Italic } from "@expo-google-fonts/atkinson-hyperlegible";
import Svg, { Path } from "react-native-svg";

const parchment = require("../../assets/Splash Screen/pexels-pixabay-235985 (1) 3.png");
const skull = require("../../assets/Splash Screen/Ark3 3.png");
const d20 = require("../../assets/Splash Screen/Group 5947.png");
const loaderArt = require("../../assets/Splash Screen/Loader.png");

function QuillRule({ width }: { width: number }) {
  const h = 16;
  const d = [
    `M 1 ${h * 0.62}`,
    `C ${width * 0.08} ${h * 0.18}, ${width * 0.16} ${h * 0.92}, ${width * 0.26} ${h * 0.48}`,
    `S ${width * 0.4} ${h * 0.12}, ${width * 0.5} ${h * 0.58}`,
    `S ${width * 0.66} ${h * 0.95}, ${width * 0.78} ${h * 0.42}`,
    `S ${width * 0.9} ${h * 0.22}, ${width - 1} ${h * 0.7}`,
  ].join(" ");

  return (
    <Svg width={width} height={h} style={styles.rule}>
      <Path
        d={d}
        stroke="#2A2218"
        strokeWidth={1.35}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.72}
      />
    </Svg>
  );
}

export default function SplashScreen() {
  const { width, height } = useWindowDimensions();
  const spin = useRef(new Animated.Value(0)).current;
  const [percent, setPercent] = useState(0);
  const [titleW, setTitleW] = useState(220);

  const [fontsLoaded] = useFonts({
    CinzelDecorative_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
  });

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 8000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [spin]);

  useEffect(() => {
    let value = 0;
    const id = setInterval(() => {
      value += 1;
      if (value >= 100) {
        value = 100;
        clearInterval(id);
      }
      setPercent(value);
    }, 35);
    return () => clearInterval(id);
  }, []);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const skullW = width * 0.94;
  const skullH = skullW * 0.95;
  const loaderSize = Math.min(width * 0.62, 240);
  const dieW = skullW * 0.42;
  const dieH = dieW * 0.82;

  if (!fontsLoaded) {
    return <View style={styles.fallback} />;
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <Image source={parchment} style={styles.parchment} resizeMode="cover" />

      <View style={[styles.column, { paddingBottom: Math.max(height * 0.06, 44) }]}>
        <View style={{ width: skullW, height: skullH, marginTop: 56 }}>
          <Image
            source={skull}
            style={{ width: skullW, height: skullH }}
            resizeMode="contain"
          />
          <Image
            source={d20}
            style={{
              position: "absolute",
              width: dieW,
              height: dieH,
              left: (skullW - dieW) / 2,
              top: skullH * 0.528,
            }}
            resizeMode="contain"
          />
        </View>

        <Text
          style={styles.wordmark}
          onLayout={(e) => setTitleW(e.nativeEvent.layout.width)}
        >
          Arkane Aid
        </Text>
        <QuillRule width={Math.max(titleW, 180)} />

        <View style={[styles.loaderWrap, { width: loaderSize, height: loaderSize }]}>
          <Animated.Image
            source={loaderArt}
            style={[styles.loader, { transform: [{ rotate }] }]}
            resizeMode="contain"
          />
          <Text style={styles.percent}>{percent}%</Text>
        </View>

        <Text style={styles.caption}>
          Just a moment{"\u2026"}
          {"\n"}
          the barbarian is stuck in a doorway.
        </Text>
      </View>
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
  column: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  wordmark: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#A33A3A",
    fontSize: 42,
    textAlign: "center",
    marginTop: -40,
    opacity: 0.82,
  },
  rule: {
    marginTop: 2,
    marginBottom: 8,
  },
  loaderWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  loader: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  percent: {
    fontFamily: "CinzelDecorative_400Regular",
    color: "#2A2218",
    fontSize: 30,
    letterSpacing: 1.5,
    textAlign: "center",
    opacity: 0.72,
  },
  caption: {
    marginTop: 14,
    fontFamily: "AtkinsonHyperlegible_400Regular_Italic",
    color: "#5A5348",
    fontSize: 15,
    letterSpacing: 1.4,
    textAlign: "center",
    lineHeight: 22,
    opacity: 0.78,
  },
});
