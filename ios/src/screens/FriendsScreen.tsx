import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { FriendListRow } from "@/src/components/FriendListRow";
import { fetchFriends, acceptFriend } from "@/src/lib/api";
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
        <Text style={styles.muted}>sign in to see friends</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>loading…</Text>
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
      ListEmptyComponent={<Text style={styles.muted}>no friends yet</Text>}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  muted: { color: "#888", fontSize: 14, padding: 16 },
});
