// Arkane Aid colour tokens, taken from the ARKANE-AID-DEV Figma file ("Final Work").
// Use these instead of typing hex codes into screens.
export const colors = {
  // Base
  wash: "#E8D7B8", // screen background under the parchment texture
  ink: "#1A1816", // main text and outlines
  muted: "#5A5348", // secondary text
  placeholder: "#8A8175", // input placeholders
  cream: "#FEFCEB", // text on red buttons
  gold: "#BD7F02",

  // Reds
  wordmark: "#A33A3A", // links, errors, outline buttons
  primary: "#C44536", // filled buttons (brick red)
  activeTab: "#960000", // selected tab label
  statLabel: "#D9D9D9", // labels on the red stat headers

  // Parchment panels and frames
  panel: "#FFEBC8",
  panelStroke: "#764F00",
  cardStroke: "#3F382D",
  statStroke: "#3C341C",
  rule: "#2E2E2E", // thin divider lines
  chevron: "#2C2C2C",
  portrait: "#C8B48A",

  // The Sage orb
  orbBackdrop: "#1A0A0A", // dark disc behind the 3D orb
  orbGlow: "#F6D77A", // warm gold of the orb light and its fallback text
  shadowBrown: "#2A1C0A", // deep brown used for the vignette edge and the reply card shadow
} as const;

export type ColorName = keyof typeof colors;
