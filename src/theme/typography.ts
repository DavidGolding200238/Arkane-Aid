import { useFonts } from "expo-font";
import {
  CinzelDecorative_400Regular,
  CinzelDecorative_700Bold,
} from "@expo-google-fonts/cinzel-decorative";
import { Asul_400Regular, Asul_700Bold } from "@expo-google-fonts/asul";
import { AtkinsonHyperlegible_400Regular } from "@expo-google-fonts/atkinson-hyperlegible";
import { MedievalSharp_400Regular } from "@expo-google-fonts/medievalsharp";

// Font family names as registered with expo-font.
export const fonts = {
  title: "CinzelDecorative_400Regular", // screen titles
  titleBold: "CinzelDecorative_700Bold", // character name
  heading: "Asul_400Regular", // race, class, list items
  headingBold: "Asul_700Bold", // headings, tabs, buttons, dates
  body: "AtkinsonHyperlegible_400Regular", // paragraphs and inputs
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
    MedievalSharp_400Regular,
  });
  return loaded;
}
