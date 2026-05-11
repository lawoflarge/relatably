import React from "react";
import { Pressable, Text, StyleProp, ViewStyle } from "react-native";
import { palette, radii, shadow, typography, sp } from "@/src/theme/tokens";

type Variant = "primary" | "secondary" | "tertiary";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  rotate?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANT: Record<Variant, {
  fill: keyof typeof palette;
  fg: keyof typeof palette;
  borderWidth: 2 | 3;
  shadowSize: keyof typeof shadow;
  radius: keyof typeof radii;
  font: typeof typography.h3 | typeof typography.bodyS;
}> = {
  primary:   { fill: "pink",  fg: "cream", borderWidth: 3, shadowSize: "l", radius: "l",    font: typography.h3 },
  secondary: { fill: "mint",  fg: "ink",   borderWidth: 2, shadowSize: "s", radius: "pill", font: typography.bodyS },
  tertiary:  { fill: "cream", fg: "ink",   borderWidth: 2, shadowSize: "s", radius: "pill", font: typography.bodyS },
};

export function StickerButton({ label, onPress, variant = "primary", disabled, rotate, testID, style }: Props) {
  const v = VARIANT[variant];
  const s = shadow[v.shadowSize];
  return (
    <Pressable
      role="button"
      disabled={!!disabled}
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      testID={testID}
      style={[
        {
          backgroundColor: disabled ? palette.cream : palette[v.fill],
          borderColor: palette.ink,
          borderWidth: v.borderWidth,
          borderRadius: radii[v.radius],
          paddingVertical: variant === "primary" ? sp[4] + 2 : sp[2],
          paddingHorizontal: variant === "primary" ? sp[5] + sp[1] : sp[3] + 2,
          shadowColor: s.color,
          shadowOffset: s.offset,
          shadowRadius: s.radius,
          shadowOpacity: disabled ? 0 : s.opacity,
          elevation: disabled ? 0 : s.elevation,
          transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
          opacity: disabled ? 0.4 : 1,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text
        style={{
          color: palette[v.fg],
          fontFamily: v.font.family,
          fontSize: v.font.size,
          lineHeight: v.font.line,
          letterSpacing: "letterSpacing" in v.font ? (v.font as any).letterSpacing : 0,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
