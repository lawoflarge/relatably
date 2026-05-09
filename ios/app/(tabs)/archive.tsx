import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
import { ArchiveScreen } from "@/src/screens/ArchiveScreen";
import { ShareCardVerdict } from "@/src/components/ShareCardVerdict";
import { fetchArchive } from "@/src/lib/api";
import { shareCardImage } from "@/src/lib/shareCard";
import type { ArchiveTile } from "@/src/types/api";

export default function ArchiveTab() {
  const [tiles, setTiles] = useState<ArchiveTile[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [longPressedTile, setLongPressedTile] = useState<ArchiveTile | null>(null);
  const shareRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchArchive()
      .then((page) => {
        if (cancelled) return;
        setTiles(page.tiles);
        setNextCursor(page.next_cursor);
      })
      .catch(() => {
        if (!cancelled) Alert.alert("couldn't load archive");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const onLoadMore = useCallback(async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    try {
      const page = await fetchArchive(nextCursor);
      setTiles((prev) => [...prev, ...page.tiles]);
      setNextCursor(page.next_cursor);
    } catch {
      // best-effort; user can scroll back up and try again
    } finally {
      setLoading(false);
    }
  }, [nextCursor, loading]);

  const onTilePress = useCallback((id: string) => {
    router.push(`/(tabs)/archive/${id}`);
  }, []);

  const onTileLongPress = useCallback(async (tile: ArchiveTile) => {
    setLongPressedTile(tile);
    // Defer one tick so React renders the offscreen ShareCardVerdict before captureRef.
    setTimeout(() => {
      if (!shareRef.current) return;
      shareCardImage({
        viewRef: shareRef,
        banner_type: "verdict",
        question_id: tile.question_id,
        share_target: "system",
      }).catch(() => {
        // best-effort; user can try again
      });
    }, 50);
  }, []);

  return (
    <>
      <ArchiveScreen
        tiles={tiles}
        nextCursor={nextCursor}
        onLoadMore={onLoadMore}
        onTilePress={onTilePress}
        onTileLongPress={onTileLongPress}
      />
      {longPressedTile && (
        <View
          ref={shareRef}
          collapsable={false}
          pointerEvents="none"
          style={{ position: "absolute", left: -10000, top: -10000, opacity: 0 }}
        >
          <ShareCardVerdict
            verdictText={longPressedTile.verdict_text}
            topClusters={longPressedTile.top_clusters.map((text, i) => ({ canonical_text: text, final_rank: i + 1 }))}
            userRank={null}
            percentile={null}
            date={new Date(longPressedTile.created_at).toLocaleDateString()}
          />
        </View>
      )}
    </>
  );
}
