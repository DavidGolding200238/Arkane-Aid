import { View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "../theme";

type Props = {
  width?: DimensionValue;
  color?: string;
  thickness?: number;
  style?: StyleProp<ViewStyle>;
};

// A thin drawn divider. Replaces the blurry 221 x 3 underline PNG.
export default function Rule({ width = "100%", color = colors.rule, thickness = 1, style }: Props) {
  return <View style={[{ width, height: thickness, backgroundColor: color, alignSelf: "center" }, style]} />;
}
