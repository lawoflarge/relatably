import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconCrown({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M3 7L7 12L12 5L17 12L21 7V18H3V7Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
