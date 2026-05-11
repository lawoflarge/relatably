import React, { useMemo, useRef } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";

import { palette, sp, typography } from "@/src/theme/tokens";
import { PaperTexture } from "@/src/components/sticker/PaperTexture";
import { ClusterBubble } from "@/src/components/ClusterBubble";
import { ShareButton } from "@/src/components/ShareButton";
import { ShareCardTodaysTake } from "@/src/components/ShareCardTodaysTake";
import { wordcloudLayout } from "@/src/lib/wordcloudLayout";

export interface Cluster { id: string; canonical_text: string; submission_count: number; }

interface Props {
  clusters: Cluster[];
  selfClusterId: string | null;
  totalCount: number;
  questionId?: string;
  questionText?: string;
  userAnswer?: string;
  dateLabel?: string;
}

export function WordcloudScreen({ clusters, selfClusterId, totalCount, questionId, questionText, userAnswer, dateLabel }: Props) {
  const cardRef = useRef<View>(null);
  const { width } = useWindowDimensions();
  const cloudWidth = width - sp.gutter * 2;
  const cloudHeight = 560;

  const placements = useMemo(() => {
    return wordcloudLayout(
      clusters.map((c) => ({ id: c.id, text: c.canonical_text, count: c.submission_count })),
      { width: cloudWidth, height: cloudHeight },
    );
  }, [clusters, cloudWidth]);

  const placementById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const maxCount = useMemo(() => Math.max(0, ...clusters.map((c) => c.submission_count)), [clusters]);

  const shareEnabled = !!(questionId && questionText && userAnswer && dateLabel);

  return (
    <View style={styles.root}>
      <PaperTexture />
      <View style={styles.headerRow}>
        <Text style={styles.counter}>{totalCount.toLocaleString()} VOTES · THE WORLD IS VOTING</Text>
        {shareEnabled && (
          <ShareButton
            viewRef={cardRef as unknown as React.RefObject<unknown>}
            banner_type="todays_take"
            question_id={questionId as string}
            share_target="system"
            label="SHARE"
          />
        )}
      </View>
      <View style={[styles.cloud, { width: cloudWidth, height: cloudHeight }]}>
        {clusters.map((c, i) => {
          const p = placementById.get(c.id);
          if (!p) return null;
          return (
            <View key={c.id} style={{ position: "absolute", left: p.x - 60, top: p.y - 20 }}>
              <ClusterBubble
                id={c.id}
                text={c.canonical_text}
                count={c.submission_count}
                maxCount={maxCount}
                isSelf={c.id === selfClusterId}
                colorIndex={i}
              />
            </View>
          );
        })}
      </View>
      {shareEnabled && (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <View ref={cardRef} collapsable={false}>
            <ShareCardTodaysTake
              questionText={questionText as string}
              userAnswer={userAnswer as string}
              date={dateLabel as string}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream, paddingTop: sp[7], paddingHorizontal: sp.gutter },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: sp[4] },
  counter: { fontFamily: typography.label.family, fontSize: 11, letterSpacing: 1.4, color: palette.inkSoft },
  cloud: { alignSelf: "center", position: "relative" },
  offscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
});
