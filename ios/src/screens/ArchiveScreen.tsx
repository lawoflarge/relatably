import { View, Text, FlatList, StyleSheet } from "react-native";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";

export interface ArchiveTile {
  question_id: string;
  verdict_text: string;
  thumbnail: string | null;
}

interface Props {
  tiles?: ArchiveTile[];
}

type Row =
  | { kind: "tile"; tile: ArchiveTile; index: number }
  | { kind: "ad"; key: string };

function interleaveAds(tiles: ArchiveTile[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < tiles.length; i++) {
    rows.push({ kind: "tile", tile: tiles[i], index: i });
    if ((i + 1) % 8 === 0) rows.push({ kind: "ad", key: `archive-banner-${i + 1}` });
  }
  return rows;
}

export function ArchiveScreen({ tiles = [] }: Props) {
  if (tiles.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>archive coming soon — past verdicts will appear here.</Text>
      </View>
    );
  }
  const rows = interleaveAds(tiles);
  return (
    <FlatList
      style={styles.root}
      data={rows}
      keyExtractor={(r) => (r.kind === "ad" ? r.key : r.tile.question_id)}
      renderItem={({ item }) => {
        if (item.kind === "ad") return <BannerAdSlot slot="archive_banner" />;
        return (
          <View style={styles.tile}>
            <Text style={styles.tileVerdict}>{item.tile.verdict_text}</Text>
          </View>
        );
      }}
      initialNumToRender={30}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 32 },
  muted: { color: "#888", fontSize: 14, textAlign: "center" },
  tile: { padding: 16, borderBottomColor: "#222", borderBottomWidth: 1 },
  tileVerdict: { color: "#fff", fontSize: 18, fontWeight: "700" },
});
