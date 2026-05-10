import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconArchive({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M3 6H21V9H3V6Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M5 9V20H19V9" stroke={color} strokeWidth={2} strokeLinecap="square" strokeLinejoin="round" />
      <Path d="M10 13H14" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}
