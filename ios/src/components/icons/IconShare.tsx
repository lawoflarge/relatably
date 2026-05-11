import React from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconShare({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Circle cx="6" cy="12" r="2.5" stroke={color} strokeWidth={2} />
      <Circle cx="18" cy="6" r="2.5" stroke={color} strokeWidth={2} />
      <Circle cx="18" cy="18" r="2.5" stroke={color} strokeWidth={2} />
      <Path d="M8 11L16 7M8 13L16 17" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}
