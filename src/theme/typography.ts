import { useFonts } from "expo-font";
import {
  CinzelDecorative_400Regular,
  CinzelDecorative_700Bold,
} from "@expo-google-fonts/cinzel-decorative";
import { Asul_400Regular, Asul_700Bold } from "@expo-google-fonts/asul";
import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_400Regular_Italic,
} from "@expo-google-fonts/atkinson-hyperlegible";
import { MedievalSharp_400Regular } from "@expo-google-fonts/medievalsharp";

// Font family names as registered with expo-font.
export const fonts = {
  title: "CinzelDecorative_400Regular", // screen titles
  titleBold: "CinzelDecorative_700Bold", // character name
  heading: "Asul_400Regular", // race, class, list items
  headingBold: "Asul_700Bold", // headings, tabs, buttons, dates
  body: "AtkinsonHyperlegible_400Regular", // paragraphs and inputs
  bodyItalic: "AtkinsonHyperlegible_400Regular_Italic", // Sage status line
  stat: "MedievalSharp_400Regular", // ability scores and badges
} as const;

// Font sizes in Figma units. Pass them through `fs()` from ./scale.
export const fontSize = {
  caption: 12,
  small: 13,
  body: 15,
  heading: 18,
  title: 30,
  stat: 30,
} as const;

// Loads every font the themed screens use. expo-font registers fonts
// globally, so calling this from several screens only loads them once.
export function useAppFonts() {
  const [loaded] = useFonts({
    CinzelDecorative_400Regular,
    CinzelDecorative_700Bold,
    Asul_400Regular,
    Asul_700Bold,
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_400Regular_Italic,
    MedievalSharp_400Regular,
  });
  return loaded;
}

// Quill ink for headings. The Figma heading fonts stay (Cinzel Decorative, Asul); the ink is
// what changes: near-black brown-black #1A1816 with a faint soft bleed around the strokes, the
// way iron-gall ink spreads a little into paper. Body text is left alone.
export const ink = {
  heading: {
    color: "#1A1816",
    textShadowColor: "rgba(26, 24, 22, 0.38)",
    textShadowOffset: { width: 0, height: 0.6 },
    textShadowRadius: 1.6,
  },
  // Red ink for the wordmark and red labels, bleeding in its own colour.
  red: {
    textShadowColor: "rgba(163, 58, 58, 0.34)",
    textShadowOffset: { width: 0, height: 0.6 },
    textShadowRadius: 1.6,
  },
} as const;
