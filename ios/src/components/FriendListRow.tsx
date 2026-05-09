import { View, Text, Pressable, StyleSheet } from "react-native";
import type { Friendship } from "@/src/types/api";

interface Props {
  friendship: Friendship;
  onAccept?: () => void;
}

export function FriendListRow({ friendship, onAccept }: Props) {
  const display = friendship.handle ?? `@${friendship.friend_user_id.slice(0, 6)}`;
  return (
    <View style={styles.row}>
      <Text style={styles.handle}>{display}</Text>
      <Text style={styles.status}>{friendship.status}</Text>
      {onAccept && (
        <Pressable onPress={onAccept} style={styles.acceptBtn} role="button">
          <Text style={styles.acceptLabel}>ACCEPT</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomColor: "#222", borderBottomWidth: 1 },
  handle: { color: "#fff", fontSize: 16, flex: 1 },
  status: { color: "#888", fontSize: 12, marginRight: 12 },
  acceptBtn: { backgroundColor: "#aaff00", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  acceptLabel: { color: "#000", fontWeight: "800", fontSize: 12, letterSpacing: 1 },
});
