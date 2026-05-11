import { useEffect, useRef, useState } from "react";
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { fetchArchiveDetail } from "@/src/lib/api";
import { PaperTexture } from "@/src/components/sticker/PaperTexture";
import { ShareButton } from "@/src/components/ShareButton";
import { ShareCardVerdict } from "@/src/components/ShareCardVerdict";
import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
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
        <ActivityIndicator color={palette.pink} size="large" />
        <Text style={styles.muted}>loading…</Text>
      </View>
    );
  }

  if (state.kind === "error") {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>couldn't load this archive entry.</Text>
      </View>
    );
  }

  const { detail } = state;
  const verdict = detail.top_clusters[0]?.canonical_text ?? "";
  return (
    <View style={styles.root}>
      <PaperTexture />
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.dateTab}>
            <Text style={styles.dateText}>{formatDate(detail.created_at).toUpperCase()}</Text>
          </View>
          <Text style={styles.verdictText}>{verdict}</Text>
          <Text style={styles.questionText}>{detail.text}</Text>
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
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{item.final_rank}</Text>
            </View>
            <Text style={styles.canonical} numberOfLines={2}>{item.canonical_text}</Text>
            <Text style={styles.pct}>{(item.final_pct_of_total * 100).toFixed(1)}%</Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 120 }}
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
  root: { flex: 1, backgroundColor: palette.cream, paddingTop: sp[7] },
  center: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center", gap: sp[3] },
  muted: { fontFamily: typography.body.family, fontSize: 15, color: palette.inkSoft },
  errorText: { fontFamily: typography.body.family, fontSize: 15, color: palette.red, textAlign: "center", paddingHorizontal: sp[5] },
  headerRow: {
    flexDirection: "row", alignItems: "flex-start",
    paddingHorizontal: sp.gutter, paddingTop: sp[3], paddingBottom: sp[4],
    gap: sp[3],
    borderBottomColor: palette.ink, borderBottomWidth: 2,
  },
  dateTab: {
    alignSelf: "flex-start",
    backgroundColor: palette.ink, paddingHorizontal: sp[2], paddingVertical: 4, borderRadius: 6,
    marginBottom: sp[2],
  },
  dateText: { fontFamily: typography.micro.family, fontSize: 10, letterSpacing: 1.4, color: palette.cream },
  verdictText: {
    fontFamily: typography.h2.family,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.line,
    color: palette.pink,
    marginBottom: sp[2],
  },
  questionText: {
    fontFamily: typography.bodyL.family,
    fontSize: typography.bodyL.size,
    lineHeight: typography.bodyL.line,
    color: palette.inkSoft,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: sp.gutter,
    paddingVertical: sp[3],
    borderBottomColor: palette.cream2,
    borderBottomWidth: 1,
    gap: sp[3],
  },
  rankBadge: {
    width: 36, height: 36, borderRadius: radii.s,
    backgroundColor: palette.lemon, borderColor: palette.ink, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  rankText: { fontFamily: typography.label.family, fontSize: 11, color: palette.ink, letterSpacing: 1.1 },
  canonical: { fontFamily: typography.body.family, fontSize: 15, color: palette.ink, flex: 1 },
  pct: { fontFamily: typography.bodyS.family, fontSize: 13, color: palette.inkSoft },
  shareCardOffscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
});
