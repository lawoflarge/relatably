import { View, Text, StyleSheet } from "react-native";

interface Props {
  verdictText: string;
  clusterCount: number;
  handle: string | null;
  date: string;
}

const ACCENT = "#aaff00";

export function ShareCardCalledIt({ verdictText, clusterCount, handle, date }: Props) {
  const display = handle ? `@${handle}` : "@anonymous";
  const formatted = clusterCount.toLocaleString("en-US");
  return (
    <View testID="share-card-called-it" style={styles.card}>
      <Text style={styles.crown}>👑 I CALLED IT 👑</Text>
      <Text style={styles.lede}>I was the FIRST person on Earth to type</Text>
      <Text style={styles.verdict}>{verdictText.toUpperCase()}</Text>
      <Text style={styles.subhead}>Today&apos;s most relatable take.</Text>
      <Text style={styles.count}>• {formatted} of you agreed •</Text>
      <Text style={styles.handle}>{display}</Text>
      <Text style={styles.brandLine}>RELATABLY · {date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: 1080, height: 1920, backgroundColor: "#000", padding: 96, justifyContent: "center", alignItems: "center" },
  crown: { color: ACCENT, fontSize: 80, fontWeight: "900", letterSpacing: 2, marginBottom: 64 },
  lede: { color: "#fff", fontSize: 48, fontWeight: "600", textAlign: "center", marginBottom: 32 },
  verdict: { color: ACCENT, fontSize: 144, fontWeight: "900", textAlign: "center", letterSpacing: 4, marginBottom: 64 },
  subhead: { color: "#fff", fontSize: 40, fontWeight: "600", textAlign: "center" },
  count: { color: "#888", fontSize: 36, fontWeight: "500", textAlign: "center", marginVertical: 32 },
  handle: { color: "#fff", fontSize: 56, fontWeight: "800", textAlign: "center", marginTop: 96 },
  brandLine: { color: "#666", fontSize: 32, fontWeight: "600", textAlign: "center", marginTop: 32 },
});
