import { useRef } from "react";
import { View, StyleSheet, ScrollView, Text } from "react-native";
import { ClusterBubble } from "../components/ClusterBubble";
import { ShareButton } from "../components/ShareButton";
import { ShareCardTodaysTake } from "../components/ShareCardTodaysTake";

export interface Cluster {
  id: string;
  canonical_text: string;
  submission_count: number;
}

interface Props {
  clusters: Cluster[];
  selfClusterId: string | null;
  totalCount: number;
  questionId?: string;
  questionText?: string;
  userAnswer?: string;
  dateLabel?: string;
}

export function WordcloudScreen({
  clusters,
  selfClusterId,
  totalCount,
  questionId,
  questionText,
  userAnswer,
  dateLabel,
}: Props) {
  const cardRef = useRef<View>(null);
  const sorted = [...clusters].sort(
    (a, b) => b.submission_count - a.submission_count,
  );
  const max = sorted[0]?.submission_count ?? 0;

  const shareEnabled = !!(questionId && questionText && userAnswer && dateLabel);

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>
        {totalCount.toLocaleString()} answers • the world is voting
      </Text>
      {shareEnabled && (
        <View style={styles.shareBar}>
          <ShareButton
            viewRef={cardRef as unknown as React.RefObject<unknown>}
            banner_type="todays_take"
            question_id={questionId as string}
            share_target="system"
            label="🌍 share"
          />
        </View>
      )}
      <ScrollView contentContainerStyle={styles.cloud}>
        {sorted.map((c) => (
          <ClusterBubble
            key={c.id}
            text={c.canonical_text}
            count={c.submission_count}
            maxCount={max}
            isSelf={c.id === selfClusterId}
          />
        ))}
      </ScrollView>
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
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 60,
    paddingHorizontal: 12,
  },
  counter: {
    color: "#888",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  shareBar: {
    position: "absolute",
    top: 60,
    right: 16,
    zIndex: 10,
  },
  cloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
  offscreen: {
    position: "absolute",
    left: -10000,
    top: -10000,
    opacity: 0,
  },
});
