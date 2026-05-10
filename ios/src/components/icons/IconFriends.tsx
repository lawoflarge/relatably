import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconFriends({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth={2} />
      <Path d="M3 20C3 16.5 5.5 14 9 14C12.5 14 15 16.5 15 20" stroke={color} strokeWidth={2} strokeLinecap="square" />
      <Circle cx="17" cy="8.5" r="2.5" stroke={color} strokeWidth={2} />
      <Path d="M14.5 14.5C17.2 14.5 20 16 20.5 20" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}
