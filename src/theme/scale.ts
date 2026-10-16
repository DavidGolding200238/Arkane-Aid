import { PixelRatio, useWindowDimensions } from "react-native";

// Figma frames are 360 x 780. Sizes in the design are written in those units
// and scaled to the real screen here, so every screen uses the same maths.
export const DESIGN_WIDTH = 360;
export const DESIGN_HEIGHT = 780;

// Keep very small and very large screens (tablets, foldables) sensible.
const MIN_RATIO = 0.85;
const MAX_RATIO = 1.5;

// How strongly text follows the screen width. 1 = same as layout, 0 = fixed.
// 0.75 keeps text readable on small phones without getting huge on big ones.
const FONT_FACTOR = 0.75;

export type Scale = {
  width: number;
  height: number;
  ratio: number;
  /** Unclamped min(width / 360, height / 780), so a whole Figma frame fits on screen. The Dashboard stage uses it. */
  fit: number;
  /** Scale a layout size (width, height, padding, radius) from Figma units. */
  s: (size: number) => number;
  /** Scale a font size from Figma units, more gently than layout. */
  fs: (size: number) => number;
};

export function makeScale(width: number, height: number): Scale {
  const ratio = Math.min(MAX_RATIO, Math.max(MIN_RATIO, width / DESIGN_WIDTH));
  const fontRatio = 1 + (ratio - 1) * FONT_FACTOR;
  return {
    width,
    height,
    ratio,
    fit: Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT),
    s: (size) => PixelRatio.roundToNearestPixel(size * ratio),
    fs: (size) => PixelRatio.roundToNearestPixel(size * fontRatio),
  };
}

// On a Galaxy A55/A56 (about 412 dp wide) layout scales by about 1.14,
// matching the width / 360 maths the screens already used, and text by about 1.11.
export function useScale(): Scale {
  const { width, height } = useWindowDimensions();
  return makeScale(width, height);
}
