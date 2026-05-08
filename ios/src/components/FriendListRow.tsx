import { View, Text, Pressable, StyleSheet } from "react-native";

type Status = "accepted" | "pending_incoming" | "pending_outgoing";

interface Props {
  id: string;
  handle: string | null;
  status: Status;
  onAccept?: (id: string) => void;
}

export function FriendListRow({ id, handle, status, onAccept }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.handle} numberOfLines={1}>{handle ?? "anon"}</Text>
      {status === "pending_incoming" && onAccept && (
        <Pressable onPress={() => onAccept(id)} style={styles.acceptBtn}>
          <Text style={styles.acceptLabel}>ACCEPT</Text>
        </Pressable>
      )}
      {status === "pending_outgoing" && <Text style={styles.muted}>sent</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  handle: { color: "#fff", fontSize: 16, flex: 1 },
  muted: { color: "#888", fontSize: 14 },
  acceptBtn: { backgroundColor: "#aaff00", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  acceptLabel: { color: "#000", fontSize: 12, fontWeight: "700", letterSpacing: 1 },
});
