import { View, StyleSheet, ScrollView, Text } from "react-native";
import { ClusterBubble } from "../components/ClusterBubble";

export interface Cluster {
  id: string;
  canonical_text: string;
  submission_count: number;
}

interface Props {
  clusters: Cluster[];
  selfClusterId: string | null;
  totalCount: number;
}

export function WordcloudScreen({ clusters, selfClusterId, totalCount }: Props) {
  const sorted = [...clusters].sort(
    (a, b) => b.submission_count - a.submission_count,
  );
  const max = sorted[0]?.submission_count ?? 0;

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>
        {totalCount.toLocaleString()} answers • the world is voting
      </Text>
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
  cloud: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    alignItems: "center",
  },
});
