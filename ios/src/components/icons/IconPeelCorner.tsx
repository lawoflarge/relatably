import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconPeelCorner({ size = 24, color = palette.lemon2, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M0 0L24 0L0 24Z" fill={color} stroke={palette.ink} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
