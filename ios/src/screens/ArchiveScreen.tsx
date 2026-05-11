import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { PaperTexture } from "@/src/components/sticker/PaperTexture";
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

type Row = { kind: "tile"; tile: ArchiveTile; index: number } | { kind: "ad"; key: string };

function interleaveAds(tiles: ArchiveTile[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < tiles.length; i++) {
    rows.push({ kind: "tile", tile: tiles[i], index: i });
    if ((i + 1) % 8 === 0) rows.push({ kind: "ad", key: `archive-banner-${i + 1}` });
  }
  return rows;
}

export function ArchiveScreen({ tiles, nextCursor, onLoadMore, onTilePress, onTileLongPress }: Props) {
  const insets = useSafeAreaInsets();
  if (tiles.length === 0) {
    return (
      <View style={styles.center}>
        <PaperTexture />
        <View style={[styles.emptyCard, { transform: [{ rotate: "-1.5deg" }] }]}>
          <Text style={styles.emptyHeading}>fresh archive</Text>
          <Text style={styles.emptyBody}>
            once you answer your first drop, yesterday's verdict shows up here. come back tomorrow.
          </Text>
        </View>
      </View>
    );
  }
  const rows = interleaveAds(tiles);
  return (
    <View style={{ flex: 1, backgroundColor: palette.cream }}>
      <PaperTexture />
      <FlatList
        style={styles.root}
        data={rows}
      keyExtractor={(r) => (r.kind === "ad" ? r.key : r.tile.question_id)}
      renderItem={({ item }) => {
        if (item.kind === "ad") return <BannerAdSlot slot="archive_banner" />;
        const t = item.tile;
        const rot = item.index % 2 === 0 ? -1.5 : 1.5;
        return (
          <Pressable onPress={() => onTilePress(t.question_id)} onLongPress={() => onTileLongPress(t)} style={[styles.tile, { transform: [{ rotate: `${rot}deg` }] }]}>
            <View style={styles.dateTab}><Text style={styles.dateText}>{(t.date_label ?? "—").toUpperCase()}</Text></View>
            <Text style={styles.question} numberOfLines={3}>{t.question_text}</Text>
            <Text style={styles.verdict} numberOfLines={1}>{t.verdict_text}</Text>
            <View style={styles.thumb}><ArchiveTileThumbnail texts={t.top_clusters} /></View>
          </Pressable>
        );
      }}
      onEndReached={() => { if (nextCursor) onLoadMore(); }}
      onEndReachedThreshold={0.5}
      initialNumToRender={30}
      contentContainerStyle={{ paddingTop: insets.top + sp[5], paddingHorizontal: sp.gutter, paddingBottom: 120, gap: sp[4] }}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream },
  center: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center", paddingHorizontal: sp.gutter },
  muted: { fontFamily: typography.bodyL.family, fontSize: 16, color: palette.inkSoft, textAlign: "center" },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.ink, borderWidth: 3, borderRadius: radii.m,
    paddingHorizontal: sp[5], paddingVertical: sp[5],
    gap: sp[3], alignItems: "center", maxWidth: 360,
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
  },
  emptyHeading: { fontFamily: typography.h2.family, fontSize: typography.h2.size, lineHeight: typography.h2.line, color: palette.ink, textAlign: "center" },
  emptyBody: { fontFamily: typography.bodyL.family, fontSize: typography.bodyL.size, lineHeight: typography.bodyL.line, color: palette.inkSoft, textAlign: "center" },
  tile: {
    position: "relative",
    backgroundColor: "#FFFFFF", borderColor: palette.ink, borderWidth: 2, borderRadius: radii.m,
    paddingTop: sp[6] + 2, paddingHorizontal: sp[3], paddingBottom: sp[3],
    minHeight: 130,
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  dateTab: {
    position: "absolute", top: -10, left: 10,
    backgroundColor: palette.ink, paddingHorizontal: sp[2], paddingVertical: 4, borderRadius: 6,
  },
  dateText: { fontFamily: typography.micro.family, fontSize: 10, letterSpacing: 1.4, color: palette.cream },
  question: { fontFamily: "HankenGrotesk_700", fontSize: 11, lineHeight: 14, color: palette.inkSoft, marginBottom: sp[2] },
  verdict: { fontFamily: typography.h3.family, fontSize: 18, lineHeight: 18, color: palette.pink, marginBottom: sp[2] },
  thumb: {},
});
