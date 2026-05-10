import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconHome({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M4 12L12 5L20 12V20H14V14H10V20H4V12Z" stroke={color} strokeWidth={2} strokeLinecap="square" strokeLinejoin="round" />
    </Svg>
  );
}
