import { View, Text, StyleSheet } from "react-native";
import { palette, shadow } from "../theme/tokens";

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

export function ShareCardVerdict({ verdictText, topClusters, userRank, percentile, date }: Props) {
  const satellites = topClusters.slice(0, 6);
  return (
    <View testID="share-card-verdict" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>RELATABLY</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <View style={styles.headerStrip}>
        <Text style={styles.stripLabel}>YESTERDAY · THE WORLD SAID —</Text>
      </View>
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
  card: {
    width: 1080,
    height: 1920,
    backgroundColor: palette.cream,
    padding: 96,
    justifyContent: "space-between",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  brand: {
    color: palette.ink,
    fontSize: 56,
    fontFamily: "BagelFatOne",
    letterSpacing: 2,
  },
  date: {
    color: palette.inkSoft,
    fontSize: 36,
    fontFamily: "HankenGrotesk_700",
  },
  headerStrip: {
    backgroundColor: palette.ink,
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  stripLabel: {
    color: palette.cream,
    fontSize: 36,
    fontFamily: "HankenGrotesk_700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  verdict: {
    color: palette.pink,
    fontSize: 144,
    fontFamily: "BagelFatOne",
    letterSpacing: 4,
    textAlign: "left",
    // slight rotation via transform
    transform: [{ rotate: "-2deg" }],
    // sticker shadow
    textShadowColor: palette.ink,
    textShadowOffset: { width: 6, height: 6 },
    textShadowRadius: 0,
  },
  satellites: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 24,
  },
  satellite: {
    color: palette.inkSoft,
    fontSize: 40,
    fontFamily: "HankenGrotesk_700",
  },
  rankLine: {
    color: palette.ink,
    fontSize: 40,
    fontFamily: "HankenGrotesk_700",
  },
});
