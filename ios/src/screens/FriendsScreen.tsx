import { useEffect, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { FriendListRow } from "@/src/components/FriendListRow";
import { fetchFriends, acceptFriend } from "@/src/lib/api";
import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import type { Friendship } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
}

export function FriendsScreen({ isSignedIn }: Props) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSignedIn) {
      setLoading(false);
      return;
    }
    fetchFriends()
      .then((res) => setFriendships(res.friendships))
      .catch(() => setFriendships([]))
      .finally(() => setLoading(false));
  }, [isSignedIn]);

  const onAccept = async (id: string) => {
    await acceptFriend(id);
    const next = await fetchFriends();
    setFriendships(next.friendships);
  };

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <View style={styles.ctaCard}>
          <Text style={styles.ctaHeading}>your people</Text>
          <Text style={styles.ctaBody}>sign in to see friends and compare answers.</Text>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.pink} size="large" />
      </View>
    );
  }

  return (
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
      contentContainerStyle={{ paddingTop: sp[5], paddingBottom: 120 }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream },
  center: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center", paddingHorizontal: sp.gutter },
  ctaCard: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.ink, borderWidth: 2, borderRadius: radii.m,
    paddingVertical: sp[5], paddingHorizontal: sp[5],
    alignItems: "center", gap: sp[3],
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
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
