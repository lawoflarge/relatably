// ios/src/components/LeaderboardRow.tsx
import React from "react";
import { Text, View, StyleSheet, Pressable, ActionSheetIOS, Alert, Platform } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { IconFlame } from "@/src/components/icons";
import { blockUser, reportContent } from "@/src/lib/api";
import { addBlockedUser } from "@/src/lib/hiddenContentStore";
import { getDeviceToken } from "@/src/lib/deviceId";

interface Props {
  rank: number;
  userId?: string;
  handle: string | null;
  score: number;
  streakDays: number;
  isSelf: boolean;
  crown: boolean;
  /**
   * Called after the user picks "Block this user". Parent should remove the
   * row from view immediately (App Review Guideline 1.2 requires a way to
   * block abusive users wherever their content appears).
   */
  onBlocked?: (userId: string) => void;
}

export function LeaderboardRow({ rank, userId, handle, score, streakDays, isSelf, crown, onBlocked }: Props) {
  const displayHandle = handle ?? "anon";
  const initial = (displayHandle[0] ?? "?").toUpperCase();

  const bg = isSelf ? palette.pink : crown ? palette.lemon2 : "#FFFFFF";
  const fg = isSelf ? palette.cream : palette.ink;
  const borderWidth = isSelf || crown ? 3 : 2;
  const shadowSpec = isSelf || crown ? shadow.m : shadow.s;

  const canModerate = !!userId && !isSelf;

  const doBlock = async () => {
    if (!userId) return;
    try {
      // Always record locally (works even when signed-out). Best-effort hit
      // the server endpoint — 401 for anonymous users is expected and ignored.
      await addBlockedUser({ user_id: userId, handle });
      try {
        await blockUser(userId);
      } catch {
        /* anonymous / network — local block still applies */
      }
      onBlocked?.(userId);
      Alert.alert("Blocked", "We won't show this user's content again.");
    } catch (err) {
      Alert.alert("Couldn't block", err instanceof Error ? err.message : String(err));
    }
  };

  const doReport = async () => {
    if (!userId) return;
    try {
      const deviceToken = await getDeviceToken();
      await reportContent({ target_type: "user", target_id: userId, device_token: deviceToken });
      Alert.alert("Thanks for reporting", "We'll review this account within 24 hours.");
    } catch (err) {
      Alert.alert("Couldn't report", err instanceof Error ? err.message : String(err));
    }
  };

  const handleLongPress = () => {
    if (!canModerate) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Block this user", "Report this user"],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          title: displayHandle,
        },
        (index) => {
          if (index === 1) doBlock();
          if (index === 2) doReport();
        },
      );
    } else {
      Alert.alert(displayHandle, undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Block this user", style: "destructive", onPress: doBlock },
        { text: "Report this user", onPress: doReport },
      ]);
    }
  };

  return (
    <Pressable
      onLongPress={canModerate ? handleLongPress : undefined}
      accessibilityHint={canModerate ? "Long-press to block or report this user" : undefined}
      style={styles.outer}
    >
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
        {canModerate && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Block or report ${displayHandle}`}
            hitSlop={8}
            onPress={handleLongPress}
            style={styles.modBtn}
          >
            <Text style={[styles.modDots, { color: fg }]}>⋯</Text>
          </Pressable>
        )}
      </View>
      {crown && (
        <View style={styles.crown}><Text style={styles.crownText}>★ #1</Text></View>
      )}
      {isSelf && (
        <View style={styles.youTab}><Text style={styles.youText}>YOU</Text></View>
      )}
    </Pressable>
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
  modBtn: { minWidth: 36, minHeight: 36, alignItems: "center", justifyContent: "center", marginLeft: sp[1] },
  modDots: { fontFamily: typography.h3.family, fontSize: 22, lineHeight: 24 },
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
