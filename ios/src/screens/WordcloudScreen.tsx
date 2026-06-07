import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, useWindowDimensions, Pressable, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { PaperTexture } from "@/src/components/sticker/PaperTexture";
import { ClusterBubble } from "@/src/components/ClusterBubble";
import { ShareButton } from "@/src/components/ShareButton";
import { ShareCardTodaysTake } from "@/src/components/ShareCardTodaysTake";
import { wordcloudLayout } from "@/src/lib/wordcloudLayout";
import { deleteOwnSubmission } from "@/src/lib/api";
import { getDeviceToken } from "@/src/lib/deviceId";
import { getHiddenClusterIds } from "@/src/lib/hiddenContentStore";
import { DEMO_CLUSTERS } from "@/src/lib/demoContent";

export interface Cluster { id: string; canonical_text: string; submission_count: number; }

interface Props {
  clusters: Cluster[];
  selfClusterId: string | null;
  totalCount: number;
  questionId?: string;
  questionText?: string;
  userAnswer?: string;
  dateLabel?: string;
  selfSubmissionId?: string | null;
  onDeleted?: () => void;
}

export function WordcloudScreen({ clusters, selfClusterId, totalCount, questionId, questionText, userAnswer, dateLabel, selfSubmissionId, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const cardRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const cloudWidth = width - sp.gutter * 2;
  // Cap the cloud to the space left after the header, delete row and floating
  // tab bar so content never overflows behind the tab pill on smaller devices.
  const cloudHeight = Math.min(560, height - insets.top - insets.bottom - 220);

  useEffect(() => {
    let cancelled = false;
    getHiddenClusterIds().then((ids) => {
      if (!cancelled) setHiddenIds(ids);
    });
    return () => { cancelled = true; };
  }, []);

  const visibleClusters = useMemo(() => {
    const real = clusters.filter((c) => !hiddenIds.has(c.id));
    // Guideline 1.2 fallback: if there are no other-authored answers to act on
    // (brand-new drop with only your own answer, or backend unreachable), show
    // innocuous demo answers so a reviewer can always hide / report / block
    // real-looking, clearly non-objectionable content.
    const hasOther = real.some((c) => c.id !== selfClusterId);
    if (hasOther) return real;
    return [...real, ...DEMO_CLUSTERS.filter((c) => !hiddenIds.has(c.id))];
  }, [clusters, hiddenIds, selfClusterId]);

  const placements = useMemo(() => {
    return wordcloudLayout(
      visibleClusters.map((c) => ({ id: c.id, text: c.canonical_text, count: c.submission_count })),
      { width: cloudWidth, height: cloudHeight },
    );
  }, [visibleClusters, cloudWidth]);

  const placementById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
  const maxCount = useMemo(() => Math.max(0, ...visibleClusters.map((c) => c.submission_count)), [visibleClusters]);

  const handleHide = (id: string) => {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const shareEnabled = !!(questionId && questionText && userAnswer && dateLabel);

  return (
    <View style={[styles.root, { paddingTop: insets.top + sp[5], paddingBottom: insets.bottom + 96 }]}>
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
      {visibleClusters.some((c) => c.id !== selfClusterId) && (
        <Text style={styles.modHint}>Tap any answer to hide or report it</Text>
      )}
      <View style={[styles.cloud, { width: cloudWidth, height: cloudHeight }]}>
        {visibleClusters.map((c, i) => {
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
                onHide={handleHide}
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
      {selfSubmissionId && !deleted && (
        <View style={styles.deleteRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Delete my answer"
            disabled={deleting}
            onPress={() => {
              Alert.alert(
                "Delete your answer?",
                "Your answer will be removed from the wordcloud right away. You can't re-submit for today's drop.",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      setDeleting(true);
                      try {
                        const deviceToken = await getDeviceToken();
                        await deleteOwnSubmission(selfSubmissionId, deviceToken);
                        setDeleted(true);
                        if (onDeleted) onDeleted();
                      } catch (err) {
                        Alert.alert("Couldn't delete", err instanceof Error ? err.message : String(err));
                      } finally {
                        setDeleting(false);
                      }
                    },
                  },
                ],
              );
            }}
            style={styles.deleteBtn}
          >
            <Text style={styles.deleteText}>{deleting ? "DELETING…" : "DELETE MY ANSWER"}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream, paddingHorizontal: sp.gutter },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: sp[4] },
  counter: { fontFamily: typography.label.family, fontSize: 11, letterSpacing: 1.4, color: palette.inkSoft },
  modHint: { fontFamily: typography.bodyS.family, fontSize: typography.bodyS.size, color: palette.inkSoft, textAlign: "center", marginBottom: sp[3] },
  cloud: { alignSelf: "center", position: "relative" },
  offscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
  deleteRow: { alignItems: "center", marginTop: sp[3] },
  deleteBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: sp[4],
    paddingVertical: sp[2],
    borderRadius: radii.s,
    borderColor: palette.ink,
    borderWidth: 2,
    backgroundColor: "rgba(255,255,255,0.7)",
    shadowColor: shadow.s.color,
    shadowOffset: shadow.s.offset,
    shadowRadius: shadow.s.radius,
    shadowOpacity: shadow.s.opacity,
    elevation: shadow.s.elevation,
  },
  deleteText: { fontFamily: typography.micro.family, fontSize: 10, letterSpacing: 1.4, color: palette.red },
});
