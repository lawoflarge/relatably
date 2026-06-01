import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { IconShare } from "@/src/components/icons";
import { shareCardImage } from "@/src/lib/shareCard";
import type { BannerType, ShareTarget } from "@/src/types/api";

interface Props {
  viewRef: React.RefObject<unknown>;
  banner_type: BannerType;
  question_id: string;
  share_target?: ShareTarget;
  label?: string;
}

export function ShareButton({ viewRef, banner_type, question_id, share_target = "system", label = "SHARE" }: Props) {
  const onPress = async () => {
    try {
      await shareCardImage({ viewRef, banner_type, question_id, share_target });
    } catch (e) {
      console.warn("share failed", e);
    }
  };
  return (
    <Pressable role="button" onPress={onPress} style={styles.btn}>
      <IconShare size={16} color={palette.ink} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: sp[2],
    minHeight: 44,
    backgroundColor: palette.mint, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.pill,
    paddingHorizontal: sp[4], paddingVertical: sp[2],
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  label: { fontFamily: typography.body.family, fontSize: 13, letterSpacing: 0.5, color: palette.ink },
});
