import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";

interface Props { slot: "leaderboard_banner" | "archive_banner" | "interstitial" }
export function BannerAdSlot(_props: Props) {
  // Disabled-mode placeholder per Phase 4 spec.
  return (
    <View testID="banner-ad-slot-disabled" style={styles.wrap}>
      <Text style={styles.label}>SPONSORED</Text>
      <Text style={styles.copy}>drop incoming ★</Text>
      <Text style={styles.cta}>TAP</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {
    marginVertical: sp[2],
    backgroundColor: palette.lemon2, borderColor: palette.ink, borderWidth: 3, borderRadius: radii.m,
    paddingVertical: sp[3], paddingHorizontal: sp[4],
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
    transform: [{ rotate: "-1deg" }],
    alignItems: "flex-start", gap: 4,
  },
  label: { fontFamily: typography.micro.family, fontSize: 10, letterSpacing: 1.4, color: palette.ink },
  copy: { fontFamily: typography.h3.family, fontSize: 18, color: palette.ink },
  cta: { fontFamily: typography.label.family, fontSize: 11, letterSpacing: 1.2, color: palette.ink },
});
