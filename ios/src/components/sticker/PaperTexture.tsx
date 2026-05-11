import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { palette } from "@/src/theme/tokens";

export function PaperTexture() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} opacity={0.06}>
        <Defs>
          <Pattern id="dots" x={0} y={0} width={12} height={12} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill={palette.ink} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#dots)" />
      </Svg>
    </View>
  );
}
