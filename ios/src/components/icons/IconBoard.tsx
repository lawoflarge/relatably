import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconBoard({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M5 20V12M12 20V6M19 20V14M3 20H21" stroke={color} strokeWidth={2} strokeLinecap="square" strokeLinejoin="round" />
    </Svg>
  );
}
