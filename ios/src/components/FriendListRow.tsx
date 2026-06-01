import React from "react";
import { Text, View, Pressable, StyleSheet, ActionSheetIOS, Alert, Platform } from "react-native";
import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import type { Friendship } from "@/src/types/api";
import { blockUser, removeFriend } from "@/src/lib/api";
import { addBlockedUser } from "@/src/lib/hiddenContentStore";

interface Props {
  friendship: Friendship;
  onAccept?: () => void;
  onBlocked?: (friendship: Friendship) => void;
}

export function FriendListRow({ friendship, onAccept, onBlocked }: Props) {
  const display = friendship.handle ?? `@${friendship.friend_user_id.slice(0, 6)}`;
  const initial = (friendship.handle ?? friendship.friend_user_id)[0]?.toUpperCase() ?? "?";

  const doBlock = async () => {
    try {
      await blockUser(friendship.friend_user_id);
      await addBlockedUser({ user_id: friendship.friend_user_id, handle: friendship.handle ?? null });
      if (onBlocked) onBlocked(friendship);
      Alert.alert("Blocked", "We won't show their content again.");
    } catch (err) {
      Alert.alert("Couldn't block", err instanceof Error ? err.message : String(err));
    }
  };

  const doRemove = async () => {
    try {
      await removeFriend(friendship.id);
      if (onBlocked) onBlocked(friendship);
    } catch (err) {
      Alert.alert("Couldn't remove", err instanceof Error ? err.message : String(err));
    }
  };

  const openMenu = () => {
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Remove from friends", "Block this user"],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
          title: display,
        },
        (index) => {
          if (index === 1) doRemove();
          if (index === 2) doBlock();
        },
      );
    } else {
      Alert.alert(display, undefined, [
        { text: "Cancel", style: "cancel" },
        { text: "Remove from friends", onPress: doRemove },
        { text: "Block", style: "destructive", onPress: doBlock },
      ]);
    }
  };

  return (
    <Pressable onLongPress={openMenu} accessibilityHint="Long-press to remove or block this user" style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>{initial}</Text>
      </View>
      <Text style={styles.handle} numberOfLines={1}>{display}</Text>
      <Text style={styles.tag}>{friendship.status === "pending" ? "PENDING" : friendship.direction.toUpperCase()}</Text>
      {onAccept && (
        <Pressable role="button" onPress={onAccept} style={styles.accept}>
          <Text style={styles.acceptLabel}>ACCEPT</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: sp[3],
    backgroundColor: "#FFFFFF", borderColor: palette.ink, borderWidth: 2, borderRadius: radii.m,
    paddingHorizontal: sp[3], paddingVertical: sp[3],
    marginVertical: sp[1],
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.mint, borderColor: palette.ink, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: typography.h3.family, fontSize: 12, color: palette.ink },
  handle: { flex: 1, fontFamily: "HankenGrotesk_700", fontSize: 15, color: palette.ink },
  accept: {
    minHeight: 44, justifyContent: "center",
    backgroundColor: palette.pink, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.pill,
    paddingHorizontal: sp[4], paddingVertical: sp[2],
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  acceptLabel: { fontFamily: typography.body.family, fontSize: 12, color: palette.cream, letterSpacing: 1 },
  tag: { fontFamily: typography.label.family, fontSize: 10, letterSpacing: 1.3, color: palette.inkSoft },
});
