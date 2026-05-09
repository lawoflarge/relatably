import { View, Text, StyleSheet } from "react-native";

interface Cluster {
  canonical_text: string;
  final_rank: number;
}

interface Props {
  verdictText: string;
  topClusters: Cluster[];
  userRank: number | null;
  percentile: number | null;
  date: string;
}

const ACCENT = "#aaff00";

export function ShareCardVerdict({ verdictText, topClusters, userRank, percentile, date }: Props) {
  const satellites = topClusters.slice(0, 6);
  return (
    <View testID="share-card-verdict" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>RELATABLY</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.label}>THE WORLD&apos;S VERDICT:</Text>
      <Text style={styles.verdict}>{verdictText.toUpperCase()}</Text>
      <View style={styles.satellites}>
        {satellites.map((c) => (
          <Text key={c.canonical_text} testID="verdict-satellite" style={styles.satellite}>
            {c.canonical_text}
          </Text>
        ))}
      </View>
      {userRank !== null && percentile !== null ? (
        <Text style={styles.rankLine}>
          I ranked #{userRank}. Better than {percentile}% of the world.
        </Text>
      ) : (
        <Text style={styles.rankLine}>sign in next time to claim a rank.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 1080, height: 1920, backgroundColor: "#000", padding: 96, justifyContent: "space-between" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#fff", fontSize: 56, fontWeight: "900", letterSpacing: 2 },
  date: { color: "#888", fontSize: 36, fontWeight: "600" },
  label: { color: "#fff", fontSize: 48, fontWeight: "700", letterSpacing: 1 },
  verdict: { color: ACCENT, fontSize: 144, fontWeight: "900", letterSpacing: 4, textAlign: "left" },
  satellites: { flexDirection: "row", flexWrap: "wrap", gap: 24 },
  satellite: { color: "#888", fontSize: 40, fontWeight: "600" },
  rankLine: { color: "#fff", fontSize: 40, fontWeight: "600" },
});
