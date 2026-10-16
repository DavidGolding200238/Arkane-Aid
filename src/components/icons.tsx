import { Image } from "react-native";
import ChevronLeftSvg from "../../assets/images/icons/icon-chevron-left.svg";
import ChevronDownSvg from "../../assets/images/icons/icon-chevron-down.svg";
import { colors } from "../theme";

const quill = require("../../assets/images/icons/icon-quill.png");

// Figma Polygon 21 is 20 x 23 inside a 44 wide circle.
// Size it from the circle so it scales with the button.
export function ChevronLeftIcon({ circleSize, color = colors.cream }: { circleSize: number; color?: string }) {
  const width = circleSize * (18 / 44);
  const height = width * (23 / 20);
  // The arrow's weight sits on its left point, so nudge it right to look centred.
  return (
    <ChevronLeftSvg
      width={width}
      height={height}
      color={color}
      style={{ marginLeft: -circleSize * 0.04 }}
    />
  );
}

// Figma Polygon 22, the "more below" mark at the bottom of the Codex panel (43 x 37).
export function ChevronDownIcon({ width, color = colors.chevron }: { width: number; color?: string }) {
  return <ChevronDownSvg width={width} height={width * (37 / 43)} color={color} />;
}

// Figma "Quill With Ink" (22 x 22 inside a 44 circle), cream (#FEFCEB) on a transparent background, as in Figma.
export function QuillIcon({ circleSize }: { circleSize: number }) {
  const size = circleSize * 0.5;
  return <Image source={quill} style={{ width: size, height: size }} resizeMode="contain" />;
}
