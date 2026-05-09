import { View, Text, StyleSheet } from "react-native";

interface Props {
  texts: string[];
}

const MAX_BUBBLES = 5;

export function ArchiveTileThumbnail({ texts }: Props) {
  const visible = texts.slice(0, MAX_BUBBLES);
  if (visible.length === 0) return null;
  return (
    <View style={styles.row}>
      {visible.map((t, i) => {
        const sizeScale = 1 - i * 0.15; // 1.0, 0.85, 0.70, 0.55, 0.40
        const fontSize = Math.max(10, Math.round(16 * sizeScale));
        return (
          <View key={`${i}-${t}`} testID="archive-thumb-bubble" style={[styles.bubble, { paddingHorizontal: 8 + i }]}>
            <Text style={[styles.text, { fontSize }]} numberOfLines={1}>
              {t}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  bubble: {
    backgroundColor: "#1a1a1a",
    borderColor: "#333",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 4,
  },
  text: {
    color: "#fff",
    fontWeight: "600",
  },
});
