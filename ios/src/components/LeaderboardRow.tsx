import { View, Text, StyleSheet } from "react-native";

interface Props {
  rank: number;
  handle: string | null;
  score: number;
  locale: string;
}

export function LeaderboardRow({ rank, handle, score }: Props) {
  return (
    <View style={styles.row}>
      <Text style={styles.rank}>#{rank}</Text>
      <Text style={styles.handle} numberOfLines={1}>{handle ?? "anon"}</Text>
      <Text style={styles.score}>{score}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 16, gap: 12 },
  rank: { color: "#888", fontSize: 14, width: 48 },
  handle: { color: "#fff", fontSize: 16, flex: 1 },
  score: { color: "#aaff00", fontSize: 16, fontWeight: "700" },
});
