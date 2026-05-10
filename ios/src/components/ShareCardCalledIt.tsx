import { View, Text, StyleSheet } from "react-native";
import { palette, shadow, radii } from "../theme/tokens";

interface Props {
  verdictText: string;
  clusterCount: number;
  handle: string | null;
  date: string;
}

export function ShareCardCalledIt({ verdictText, clusterCount, handle, date }: Props) {
  const display = handle ? `@${handle}` : "@anonymous";
  const formatted = clusterCount.toLocaleString("en-US");
  return (
    <View testID="share-card-called-it" style={styles.card}>
      <View style={styles.headerBadge}>
        <Text style={styles.headerText}>★ I CALLED IT ★</Text>
      </View>
      <Text style={styles.verdict}>{verdictText.toUpperCase()}</Text>
      <Text style={styles.count}>• {formatted} of you agreed •</Text>
      <Text style={styles.handle}>{display}</Text>
      <Text style={styles.brandLine}>RELATABLY · {date}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 1080,
    height: 1920,
    backgroundColor: palette.lemon2,
    padding: 96,
    justifyContent: "center",
    alignItems: "center",
  },
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: palette.ink,
    paddingHorizontal: 48,
    paddingVertical: 24,
    borderRadius: radii.pill,
    marginBottom: 64,
    // sticker shadow
    shadowColor: palette.ink,
    shadowOffset: shadow.m.offset,
    shadowRadius: shadow.m.radius,
    shadowOpacity: shadow.m.opacity,
    elevation: shadow.m.elevation,
  },
  headerText: {
    color: palette.cream,
    fontSize: 56,
    fontFamily: "BagelFatOne",
    letterSpacing: 2,
  },
  verdict: {
    color: palette.ink,
    fontSize: 144,
    fontFamily: "BagelFatOne",
    textAlign: "center",
    letterSpacing: 4,
    marginBottom: 64,
    // sticker shadow
    textShadowColor: palette.inkSoft,
    textShadowOffset: { width: 4, height: 4 },
    textShadowRadius: 0,
  },
  count: {
    color: palette.inkSoft,
    fontSize: 40,
    fontFamily: "HankenGrotesk_700",
    textAlign: "center",
    marginVertical: 32,
  },
  handle: {
    color: palette.ink,
    fontSize: 56,
    fontFamily: "HankenGrotesk_700",
    textAlign: "center",
    marginTop: 96,
    fontWeight: "800",
  },
  brandLine: {
    color: palette.inkSoft,
    fontSize: 32,
    fontFamily: "HankenGrotesk_700",
    textAlign: "center",
    marginTop: 32,
    letterSpacing: 2,
  },
});
