import { Text, StyleSheet, View } from "react-native";

interface Props {
  text: string;
  count: number;
  maxCount: number;
  isSelf: boolean;
}

const MIN_FONT = 14;
const MAX_FONT = 56;

export function ClusterBubble({ text, count, maxCount, isSelf }: Props) {
  const ratio = maxCount > 0 ? count / maxCount : 0;
  const fontSize = MIN_FONT + ratio * (MAX_FONT - MIN_FONT);
  return (
    <View style={[styles.bubble, isSelf && styles.self]}>
      <Text style={[styles.text, { fontSize }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    margin: 4,
    borderRadius: 8,
    backgroundColor: "#111",
  },
  self: {
    backgroundColor: "#aaff00",
  },
  text: {
    color: "#fff",
    fontWeight: "700",
  },
});
