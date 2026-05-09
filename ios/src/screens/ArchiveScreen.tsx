import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";
import { ArchiveTileThumbnail } from "@/src/components/ArchiveTileThumbnail";
import type { ArchiveTile } from "@/src/types/api";

interface Props {
  tiles: ArchiveTile[];
  nextCursor: string | null;
  onLoadMore: () => void;
  onTilePress: (questionId: string) => void;
  onTileLongPress: (tile: ArchiveTile) => void;
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

export function ArchiveScreen({ tiles, nextCursor, onLoadMore, onTilePress, onTileLongPress }: Props) {
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
        const t = item.tile;
        return (
          <Pressable
            onPress={() => onTilePress(t.question_id)}
            onLongPress={() => onTileLongPress(t)}
            style={styles.tile}
          >
            <Text style={styles.tileQuestion} numberOfLines={2}>
              {t.question_text}
            </Text>
            <Text style={styles.tileVerdict} numberOfLines={1}>
              👑 {t.verdict_text}
            </Text>
            <View style={styles.tileThumbWrap}>
              <ArchiveTileThumbnail texts={t.top_clusters} />
            </View>
          </Pressable>
        );
      }}
      onEndReached={() => {
        if (nextCursor) onLoadMore();
      }}
      onEndReachedThreshold={0.5}
      initialNumToRender={30}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", padding: 32 },
  muted: { color: "#888", fontSize: 14, textAlign: "center" },
  tile: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
    gap: 8,
  },
  tileQuestion: { color: "#fff", fontSize: 16, fontWeight: "700" },
  tileVerdict: { color: "#facc15", fontSize: 14, fontWeight: "600" },
  tileThumbWrap: { marginTop: 4 },
});
