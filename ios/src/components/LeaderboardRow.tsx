// ios/src/components/LeaderboardRow.tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { IconFlame } from "@/src/components/icons";

interface Props {
  rank: number;
  handle: string | null;
  score: number;
  streakDays: number;
  isSelf: boolean;
  crown: boolean;
}

export function LeaderboardRow({ rank, handle, score, streakDays, isSelf, crown }: Props) {
  const displayHandle = handle ?? "anon";
  const initial = (displayHandle[0] ?? "?").toUpperCase();

  const bg = isSelf ? palette.pink : crown ? palette.lemon2 : "#FFFFFF";
  const fg = isSelf ? palette.cream : palette.ink;
  const borderWidth = isSelf || crown ? 3 : 2;
  const shadowSpec = isSelf || crown ? shadow.m : shadow.s;

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.row,
          {
            backgroundColor: bg,
            borderColor: palette.ink,
            borderWidth,
            shadowColor: shadowSpec.color,
            shadowOffset: shadowSpec.offset,
            shadowRadius: shadowSpec.radius,
            shadowOpacity: shadowSpec.opacity,
            elevation: shadowSpec.elevation,
          },
        ]}
      >
        <Text style={[styles.rank, { color: fg }]}>{String(rank).padStart(2, "0")}</Text>
        <View style={styles.avatar}><Text style={styles.avatarInitial}>{initial}</Text></View>
        <View style={styles.mid}>
          <Text style={[styles.handle, { color: fg }]} numberOfLines={1}>{displayHandle}</Text>
          {streakDays > 0 && (
            <View style={styles.streakRow}>
              <IconFlame size={11} color={fg} />
              <Text style={[styles.streak, { color: fg }]}>{streakDays}-DAY STREAK</Text>
            </View>
          )}
        </View>
        <Text style={[styles.score, { color: fg }]}>{score}</Text>
      </View>
      {crown && (
        <View style={styles.crown}><Text style={styles.crownText}>★ #1</Text></View>
      )}
      {isSelf && (
        <View style={styles.youTab}><Text style={styles.youText}>YOU</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: "relative", marginVertical: sp[2] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
    paddingVertical: sp[3],
    paddingHorizontal: sp[3] + 2,
    borderRadius: radii.m,
  },
  rank: { fontFamily: typography.h3.family, fontSize: 22, width: 32 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: palette.mint, borderColor: palette.ink, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { fontFamily: typography.h3.family, fontSize: 14, color: palette.ink },
  mid: { flex: 1 },
  handle: { fontFamily: "HankenGrotesk_800", fontSize: 15 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  streak: { fontFamily: typography.micro.family, fontSize: 10, letterSpacing: 1.2 },
  score: { fontFamily: typography.h3.family, fontSize: 20 },
  crown: {
    position: "absolute", top: -10, left: -14,
    backgroundColor: palette.pink, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s,
    paddingHorizontal: sp[2], paddingVertical: 2, transform: [{ rotate: "-8deg" }],
  },
  crownText: { fontFamily: typography.h3.family, fontSize: 12, color: palette.cream },
  youTab: {
    position: "absolute", top: -12, right: -10,
    backgroundColor: palette.lemon2, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s,
    paddingHorizontal: sp[2], paddingVertical: 2, transform: [{ rotate: "4deg" }],
  },
  youText: { fontFamily: typography.micro.family, fontSize: 10, color: palette.ink, letterSpacing: 1.4 },
});
