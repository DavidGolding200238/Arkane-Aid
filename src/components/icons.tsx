import { Image } from "react-native";
import Svg, { Path } from "react-native-svg";
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

// Vector edit mark for the Ledger: a feather quill, nib down to the lower left, cream on the red
// circle with no box behind it. The shaft and the notches in the vane are cut out (even-odd), so
// the red shows through. It stays crisp at any size, where the 66 px icon-quill PNG above goes
// soft on big screens.
const QUILL =
  // vane
  "M21 2.6C14.2 3.4 9.4 8.2 7.6 15.4L8.6 16.4C15.4 14.6 20.2 9.8 21 2.6Z" +
  // shaft cut through the vane
  "M19.6 4.6L9.2 15.2L9.9 15.6L20 5Z" +
  // notches in the barbs
  "M12.6 7.6L14.1 9.1L13.7 9.5Z M16.4 11.4L14.9 9.9L15.3 9.5Z M10.4 11L11.6 12.2L11.2 12.6Z";
// nib: from the base of the feather to a point
const NIB_LINE = "M8.4 15.6L3.6 20.4";

export function QuillVectorIcon({ circleSize, color = colors.cream }: { circleSize: number; color?: string }) {
  const size = circleSize * 0.58;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={QUILL} fill={color} fillRule="evenodd" />
      <Path d={NIB_LINE} stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Path d="M3 21.4C5 21.8 7 20.8 8.6 21.6" stroke={color} strokeWidth={1.1} strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// Send mark for the Sage typing box: a cream pen nib, tip raised to the upper right as if
// about to write, with its slit and breather hole cut through (even-odd fill), so the red
// circle shows through them. Pure SVG: crisp at any size, no box behind it.
const NIB =
  "M12 1.8C13.6 4.6 16.6 8.4 17.6 11.2C18.3 13.2 17.2 14.6 16.2 15.4L15.6 21.2Q12 22.4 8.4 21.2L7.8 15.4" +
  "C6.8 14.6 5.7 13.2 6.4 11.2C7.4 8.4 10.4 4.6 12 1.8Z" +
  // breather hole
  "M10.4 12.4a1.6 1.6 0 1 0 3.2 0a1.6 1.6 0 1 0 -3.2 0Z" +
  // slit from the tip down to the hole
  "M11.55 3.4H12.45V10.9H11.55Z" +
  // the line where the nib meets the holder
  "M8.3 17.6H15.7V18.5H8.3Z";

export function SendNibIcon({ circleSize, color = colors.cream }: { circleSize: number; color?: string }) {
  const size = circleSize * 0.56;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={NIB} fill={color} fillRule="evenodd" transform="rotate(40 12 12)" />
    </Svg>
  );
}

// Reload mark for the Tome's parties list: a cream circular arrow (about 300 degrees of arc
// with an arrow head), stroked SVG so it stays crisp and has no box behind it.
export function RefreshIcon({ circleSize, color = colors.cream }: { circleSize: number; color?: string }) {
  const size = circleSize * 0.56;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" stroke={color} strokeWidth={2.6} strokeLinecap="round" />
      <Path d="M20.2 3.6v4.6h-4.6z" fill={color} stroke={color} strokeWidth={1.4} strokeLinejoin="round" />
    </Svg>
  );
}
