import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconFlame({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M12 3C12 8 17 9 17 14C17 17 14.8 20 12 20C9.2 20 7 17 7 14C7 11 9 10 9 7C10.5 8 12 7 12 3Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
