import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { palette, radii, typography } from "@/src/theme/tokens";

interface Props { texts: string[] }
const FILLS = [palette.mint, palette.lemon, palette.blue, "#FFD7E8"] as const;

export function ArchiveTileThumbnail({ texts }: Props) {
  const visible = texts.slice(0, 3);
  if (visible.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {visible.map((t, i) => (
        <View key={`${t}-${i}`} testID="archive-thumb-bubble" style={[styles.bubble, { backgroundColor: FILLS[i % FILLS.length], transform: [{ scale: 1 - i * 0.12 }] }]}>
          <Text style={styles.bubbleText} numberOfLines={1}>{t}</Text>
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  bubble: { borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s, paddingHorizontal: 8, paddingVertical: 4 },
  bubbleText: { fontFamily: typography.body.family, fontSize: 11, color: palette.ink },
});
