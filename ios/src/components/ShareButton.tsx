import { Pressable, Text, StyleSheet } from "react-native";
import type React from "react";
import { shareCardImage } from "@/src/lib/shareCard";
import type { BannerType, ShareTarget } from "@/src/types/api";

interface Props {
  viewRef: React.RefObject<unknown>;
  banner_type: BannerType;
  question_id: string;
  share_target: ShareTarget;
  label: string;
}

export function ShareButton({ viewRef, banner_type, question_id, share_target, label }: Props) {
  const onPress = async () => {
    try {
      await shareCardImage({ viewRef, banner_type, question_id, share_target });
    } catch (e) {
      console.warn("share failed", e);
    }
  };
  return (
    <Pressable role="button" onPress={onPress} style={styles.btn}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { backgroundColor: "#aaff00", paddingHorizontal: 20, paddingVertical: 10, borderRadius: 999 },
  label: { color: "#000", fontSize: 14, fontWeight: "800", letterSpacing: 1 },
});
