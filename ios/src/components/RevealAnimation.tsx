import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import type { YesterdayCluster } from "../types/api";
import { ShareCardVerdict } from "./ShareCardVerdict";
import { ShareCardCalledIt } from "./ShareCardCalledIt";
import { shareCardImage } from "../lib/shareCard";
import { palette, typography, sp, radii, shadow } from "../theme/tokens";

interface Props {
  questionId?: string;
  questionText: string;
  clusters: YesterdayCluster[]; // assumed sorted ascending by final_rank
  selfClusterId: string | null;
  selfHandle?: string | null;
  dateLabel?: string;
  onComplete: () => void;
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 1000;
const HOLD_MS_DEFAULT = 2000;

export function RevealAnimation({
  questionId,
  questionText,
  clusters,
  selfClusterId,
  selfHandle = null,
  dateLabel = "",
  onComplete,
  intervalMs = DEFAULT_INTERVAL_MS,
}: Props) {
  // Reveal order is #10 → #1 (descending rank).
  const reversed = [...clusters].sort((a, b) => b.final_rank - a.final_rank);
  const [step, setStep] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const verdictRef = useRef<View>(null);
  const calledItRef = useRef<View>(null);

  useEffect(() => {
    const total = reversed.length;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      setStep(current);
      if (current >= total) {
        clearInterval(interval);
        // When share CTAs are not active (no questionId), auto-advance
        // after a final hold to preserve Phase-2 behavior.
        if (!questionId) {
          const holdMs = intervalMs * (HOLD_MS_DEFAULT / DEFAULT_INTERVAL_MS);
          setTimeout(() => onCompleteRef.current(), holdMs);
        }
      }
    }, intervalMs);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, reversed.length, questionId]);

  const done = step >= reversed.length;
  const visible = done ? [] : reversed.slice(0, step);
  const verdict = clusters.find((c) => c.final_rank === 1);

  const userRank = selfClusterId
    ? (clusters.findIndex((c) => c.id === selfClusterId) + 1) || null
    : null;
  const userPercentile =
    userRank !== null && clusters.length > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.floor(((clusters.length - userRank + 1) / clusters.length) * 100),
          ),
        )
      : null;
  const calledIt = !!selfClusterId && verdict?.id === selfClusterId;

  const onShareVerdict = async () => {
    if (!questionId) return;
    try {
      await shareCardImage({
        viewRef: verdictRef as unknown as React.RefObject<unknown>,
        banner_type: "verdict",
        question_id: questionId,
        share_target: "system",
      });
    } catch (e) {
      console.warn("share verdict failed", e);
    }
  };

  const onShareCalledIt = async () => {
    if (!questionId) return;
    try {
      await shareCardImage({
        viewRef: calledItRef as unknown as React.RefObject<unknown>,
        banner_type: "called_it",
        question_id: questionId,
        share_target: "system",
      });
    } catch (e) {
      console.warn("share called-it failed", e);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.question}>{questionText}</Text>
      <View style={styles.cloud}>
        {visible.map((c) => (
          <Text
            key={c.id}
            style={[
              styles.bubble,
              c.id === selfClusterId && styles.selfBubble,
              { fontSize: 14 + c.final_pct_of_total * 40 },
            ]}
          >
            {c.canonical_text}
          </Text>
        ))}
      </View>
      {done && verdict && (
        <Text style={styles.verdict}>the world said — {verdict.canonical_text}</Text>
      )}

      {done && questionId && (
        <View style={styles.cta}>
          <Pressable role="button" onPress={onShareVerdict} style={styles.shareBtn}>
            <Text style={styles.shareLabel}>SHARE THE VERDICT</Text>
          </Pressable>
          {calledIt && (
            <Pressable
              role="button"
              onPress={onShareCalledIt}
              style={[styles.shareBtn, styles.crownBtn]}
            >
              <Text style={styles.shareLabel}>★ SHARE — YOU CALLED IT</Text>
            </Pressable>
          )}
          <Pressable role="button" onPress={onComplete} style={styles.continueBtn}>
            <Text style={styles.continueLabel}>continue →</Text>
          </Pressable>
        </View>
      )}

      {/* Offscreen capture targets for share cards */}
      {questionId && (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <View ref={verdictRef} collapsable={false}>
            <ShareCardVerdict
              verdictText={verdict?.canonical_text ?? ""}
              topClusters={clusters
                .slice()
                .sort((a, b) => a.final_rank - b.final_rank)
                .slice(1, 7)
                .map((c) => ({
                  canonical_text: c.canonical_text,
                  final_rank: c.final_rank,
                }))}
              userRank={userRank}
              percentile={userPercentile}
              date={dateLabel}
            />
          </View>
          <View ref={calledItRef} collapsable={false}>
            <ShareCardCalledIt
              verdictText={verdict?.canonical_text ?? ""}
              clusterCount={verdict?.submission_count ?? 0}
              handle={selfHandle}
              date={dateLabel}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.cream,
    paddingTop: 60,
    paddingHorizontal: sp.gutter,
    alignItems: "center",
  },
  question: {
    color: palette.ink,
    fontSize: typography.h2.size,
    lineHeight: typography.h2.line,
    fontFamily: typography.h2.family,
    textAlign: "center",
    marginBottom: sp[5],
  },
  cloud: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  bubble: {
    color: palette.inkSoft,
    fontFamily: typography.body.family,
    margin: 6,
  },
  selfBubble: {
    color: palette.pink,
    // hot-pink ring shadow instead of neon glow
    textShadowColor: palette.pink,
    textShadowRadius: 6,
  },
  verdict: {
    color: palette.pink,
    fontSize: typography.h1.size,
    lineHeight: typography.h1.line,
    fontFamily: typography.h1.family,
    marginVertical: sp[5],
    textAlign: "center",
  },
  cta: {
    gap: sp[3],
    paddingVertical: sp[4],
    width: "100%",
  },
  shareBtn: {
    backgroundColor: palette.pink,
    paddingHorizontal: sp[5],
    paddingVertical: 14,
    borderRadius: radii.pill,
    alignItems: "center",
    borderWidth: 2,
    borderColor: palette.ink,
    // sticker shadow
    shadowColor: palette.ink,
    shadowOffset: shadow.s.offset,
    shadowRadius: shadow.s.radius,
    shadowOpacity: shadow.s.opacity,
    elevation: shadow.s.elevation,
  },
  crownBtn: {
    backgroundColor: palette.lemon2,
  },
  shareLabel: {
    color: palette.ink,
    fontFamily: typography.label.family,
    letterSpacing: typography.label.letterSpacing,
    fontWeight: "900",
  },
  continueBtn: {
    paddingVertical: sp[3],
    alignItems: "center",
  },
  continueLabel: {
    color: palette.inkSoft,
    fontFamily: typography.bodyS.family,
    fontSize: typography.bodyS.size,
  },
  offscreen: {
    position: "absolute",
    left: -10000,
    top: -10000,
    opacity: 0,
  },
});
