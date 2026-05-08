import { useCallback, useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { FriendListRow } from "@/src/components/FriendListRow";
import { fetchFriends, acceptFriend } from "@/src/lib/api";
import type { Friendship } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
  myUid: string | null;
}

export function FriendsScreen({ isSignedIn, myUid }: Props) {
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchFriends();
      setFriendships(res.friendships);
    } catch {
      setFriendships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSignedIn) {
      reload();
    }
  }, [isSignedIn, reload]);

  if (!isSignedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>sign in to see your friends</Text>
      </View>
    );
  }

  const onAccept = async (id: string) => {
    await acceptFriend(id);
    await reload();
  };

  return (
    <View style={styles.root}>
      {loading ? (
        <Text style={styles.muted}>loading…</Text>
      ) : (
        <FlatList
          data={friendships}
          keyExtractor={(f) => f.id}
          renderItem={({ item }) => {
            const isAccepted = item.status === "accepted";
            const isIncoming = !isAccepted && item.accepter_id === myUid;
            const status = isAccepted
              ? "accepted"
              : isIncoming
              ? "pending_incoming"
              : "pending_outgoing";
            const otherUid = item.requester_id === myUid ? item.accepter_id : item.requester_id;
            return (
              <FriendListRow
                id={item.id}
                handle={otherUid}
                status={status as any}
                onAccept={isIncoming ? onAccept : undefined}
              />
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>no friends yet</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  muted: { color: "#888", fontSize: 14, padding: 16, textAlign: "center" },
});
