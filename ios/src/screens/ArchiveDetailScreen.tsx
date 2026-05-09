import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { fetchArchiveDetail } from "@/src/lib/api";
import { ShareButton } from "@/src/components/ShareButton";
import { ShareCardVerdict } from "@/src/components/ShareCardVerdict";
import type { ArchiveDetail } from "@/src/types/api";

interface Props {
  questionId: string;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; detail: ArchiveDetail }
  | { kind: "error" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function ArchiveDetailScreen({ questionId }: Props) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const shareCardRef = useRef<View>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    fetchArchiveDetail(questionId)
      .then((detail) => {
        if (!cancelled) setState({ kind: "ready", detail });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [questionId]);

  if (state.kind === "loading") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>loading…</Text>
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>couldn't load this archive entry.</Text>
      </View>
    );
  }

  const { detail } = state;
  const verdict = detail.top_clusters[0]?.canonical_text ?? "";
  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.dateLabel}>{formatDate(detail.created_at)}</Text>
          <Text style={styles.questionText}>{detail.text}</Text>
          <Text style={styles.verdictText}>👑 {verdict}</Text>
        </View>
        <ShareButton
          viewRef={shareCardRef}
          banner_type="verdict"
          question_id={detail.id}
          share_target="system"
          label="SHARE"
        />
      </View>
      <FlatList
        data={detail.top_clusters}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.rank}>#{item.final_rank}</Text>
            <Text style={styles.canonical} numberOfLines={2}>{item.canonical_text}</Text>
            <Text style={styles.pct}>{(item.final_pct_of_total * 100).toFixed(1)}%</Text>
          </View>
        )}
      />
      <View ref={shareCardRef} collapsable={false} style={styles.shareCardOffscreen} pointerEvents="none">
        <ShareCardVerdict
          verdictText={verdict}
          topClusters={detail.top_clusters.map((c) => ({ canonical_text: c.canonical_text, final_rank: c.final_rank }))}
          userRank={null}
          percentile={null}
          date={formatDate(detail.created_at)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  muted: { color: "#888", fontSize: 14 },
  headerRow: { flexDirection: "row", alignItems: "flex-start", padding: 16, gap: 12 },
  dateLabel: { color: "#888", fontSize: 12 },
  questionText: { color: "#fff", fontSize: 18, fontWeight: "700", marginTop: 4 },
  verdictText: { color: "#facc15", fontSize: 16, fontWeight: "600", marginTop: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomColor: "#222",
    borderBottomWidth: 1,
    gap: 12,
  },
  rank: { color: "#facc15", fontSize: 14, fontWeight: "700", width: 40 },
  canonical: { color: "#fff", fontSize: 14, flex: 1 },
  pct: { color: "#888", fontSize: 12 },
  shareCardOffscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
});
