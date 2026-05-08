import { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import type { YesterdayCluster } from "../types/api";

interface Props {
  questionText: string;
  clusters: YesterdayCluster[]; // assumed sorted ascending by final_rank
  selfClusterId: string | null;
  onComplete: () => void;
  intervalMs?: number;
}

const DEFAULT_INTERVAL_MS = 1000;
const HOLD_MS_DEFAULT = 2000;

export function RevealAnimation({
  questionText,
  clusters,
  selfClusterId,
  onComplete,
  intervalMs = DEFAULT_INTERVAL_MS,
}: Props) {
  // Reveal order is #10 → #1 (descending rank).
  const reversed = [...clusters].sort((a, b) => b.final_rank - a.final_rank);
  const [step, setStep] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    const total = reversed.length;
    let current = 0;

    const interval = setInterval(() => {
      current += 1;
      setStep(current);
      if (current >= total) {
        clearInterval(interval);
        // Final hold then complete.
        const holdMs = intervalMs * (HOLD_MS_DEFAULT / DEFAULT_INTERVAL_MS);
        setTimeout(() => onCompleteRef.current(), holdMs);
      }
    }, intervalMs);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, reversed.length]);

  const done = step >= reversed.length;
  const visible = done ? [] : reversed.slice(0, step);
  const verdict = clusters.find((c) => c.final_rank === 1);

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
        <Text style={styles.verdict}>🌍 the world said: {verdict.canonical_text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  question: {
    color: "#aaff00",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  cloud: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  bubble: {
    color: "#fff",
    margin: 6,
  },
  selfBubble: {
    color: "#aaff00",
    textShadowColor: "#aaff00",
    textShadowRadius: 8,
  },
  verdict: {
    color: "#aaff00",
    fontSize: 24,
    fontWeight: "800",
    marginVertical: 24,
    textAlign: "center",
  },
});
