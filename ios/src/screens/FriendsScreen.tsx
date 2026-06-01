import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FriendListRow } from "@/src/components/FriendListRow";
import { PaperTexture } from "@/src/components/sticker/PaperTexture";
import { SignInWithApple } from "@/src/components/SignInWithApple";
import { fetchFriends, acceptFriend } from "@/src/lib/api";
import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import type { Friendship } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
}

export function FriendsScreen({ isSignedIn }: Props) {
  const insets = useSafeAreaInsets();
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);
  // Locally-tracked auth bump so the CTA re-renders to the list after sign-in
  // without waiting for the parent tab wrapper to detect Firebase state change.
  const [authBump, setAuthBump] = useState(0);
  const effectiveSignedIn = isSignedIn || authBump > 0;

  useEffect(() => {
    if (!effectiveSignedIn) {
      setLoading(false);
      return;
    }
    fetchFriends()
      .then((res) => setFriendships(res.friendships))
      .catch(() => setFriendships([]))
      .finally(() => setLoading(false));
  }, [effectiveSignedIn]);

  const onAccept = async (id: string) => {
    try {
      await acceptFriend(id);
      const next = await fetchFriends();
      setFriendships(next.friendships);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "could not accept request";
      Alert.alert("couldn't accept", msg);
    }
  };

  if (!effectiveSignedIn) {
    return (
      <View style={styles.center}>
        <PaperTexture />
        <View style={[styles.ctaCard, { transform: [{ rotate: "-1.5deg" }] }]}>
          <Text style={styles.ctaHeading}>your people</Text>
          <Text style={styles.ctaBody}>sign in to see friends and compare answers.</Text>
          <View style={{ height: sp[2] }} />
          <SignInWithApple
            onSignedIn={() => setAuthBump((n) => n + 1)}
            onError={(err) => {
              const msg = err instanceof Error ? err.message : "sign-in failed";
              if (!/canceled/i.test(msg)) Alert.alert("sign in failed", msg);
            }}
          />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <PaperTexture />
        <ActivityIndicator color={palette.pink} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: palette.cream }}>
      <PaperTexture />
      <FlatList
        style={styles.root}
        data={friendships}
      keyExtractor={(f) => f.id}
      renderItem={({ item }) => (
        <FriendListRow
          friendship={item}
          onAccept={item.direction === "incoming" && item.status === "pending" ? () => onAccept(item.id) : undefined}
        />
      )}
      ListHeaderComponent={
        <Text style={styles.sectionHeader}>
          {friendships.length === 0 ? "your friends" : `your friends (${friendships.length})`}
        </Text>
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>no friends yet. share your link to invite someone!</Text>
      }
      contentContainerStyle={{ paddingTop: insets.top + sp[5], paddingBottom: 120 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream },
  center: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center", paddingHorizontal: sp.gutter },
  ctaCard: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.ink, borderWidth: 3, borderRadius: radii.m,
    paddingVertical: sp[5], paddingHorizontal: sp[5],
    alignItems: "center", gap: sp[3],
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
    maxWidth: 360,
  },
  ctaHeading: {
    fontFamily: typography.h2.family,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.line,
    color: palette.ink,
    textAlign: "center",
  },
  ctaBody: {
    fontFamily: typography.bodyL.family,
    fontSize: typography.bodyL.size,
    lineHeight: typography.bodyL.line,
    color: palette.inkSoft,
    textAlign: "center",
  },
  sectionHeader: {
    fontFamily: typography.h2.family,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.line,
    color: palette.ink,
    paddingHorizontal: sp.gutter,
    paddingBottom: sp[3],
  },
  emptyText: {
    fontFamily: typography.bodyL.family,
    fontSize: typography.bodyL.size,
    lineHeight: typography.bodyL.line,
    color: palette.inkSoft,
    paddingHorizontal: sp.gutter,
    paddingTop: sp[3],
    textAlign: "center",
  },
});
