import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { palette, radii, shadow, type ShadowSpec } from "@/src/theme/tokens";

type Fill = keyof typeof palette;
type Shadow = keyof typeof shadow;
type Radius = keyof typeof radii;

interface Props {
  children: React.ReactNode;
  fill?: Fill;
  borderWidth?: 2 | 3;
  shadowSize?: Shadow;
  radius?: Radius;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StickerSurface({
  children,
  fill = "cream",
  borderWidth = 3,
  shadowSize = "m",
  radius = "m",
  rotate,
  style,
  testID,
}: Props) {
  const s: ShadowSpec = shadow[shadowSize];
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: palette[fill],
          borderColor: palette.ink,
          borderWidth,
          borderRadius: radii[radius],
          shadowColor: s.color,
          shadowOffset: s.offset,
          shadowRadius: s.radius,
          shadowOpacity: s.opacity,
          elevation: s.elevation,
          transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
