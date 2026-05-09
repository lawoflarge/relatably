import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { LeaderboardRow } from "@/src/components/LeaderboardRow";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";
import { fetchLeaderboard } from "@/src/lib/api";
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
}

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "today" },
  { key: "weekly", label: "this week" },
  { key: "alltime", label: "all-time" },
];

type ListRow =
  | { kind: "entry"; entry: LeaderboardEntry; rank: number }
  | { kind: "ad"; key: "banner-row" };

function interleaveAd(entries: LeaderboardEntry[]): ListRow[] {
  const rows: ListRow[] = entries.map((entry, i) => ({
    kind: "entry" as const,
    entry,
    rank: entry.daily_rank ?? i + 1,
  }));
  if (entries.length >= 11) rows.splice(10, 0, { kind: "ad", key: "banner-row" });
  return rows;
}

export function LeaderboardScreen({ isSignedIn }: Props) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard({ period, scope })
      .then((res) => {
        if (!cancelled) setEntries(res.entries);
      })
      .catch(() => {
        if (!cancelled) setEntries([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period, scope]);

  const rows = interleaveAd(entries);

  return (
    <View style={styles.root}>
      <View style={styles.tabs}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={styles.tab}>
            <Text style={[styles.tabLabel, period === p.key && styles.tabLabelActive]}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scopeRow}>
        <Pressable onPress={() => setScope("global")} style={styles.scopeBtn}>
          <Text style={[styles.scopeLabel, scope === "global" && styles.scopeLabelActive]}>global</Text>
        </Pressable>
        <Pressable
          onPress={() => isSignedIn && setScope("friends")}
          style={styles.scopeBtn}
          disabled={!isSignedIn}
        >
          <Text style={[styles.scopeLabel, scope === "friends" && styles.scopeLabelActive, !isSignedIn && styles.disabled]}>
            friends
          </Text>
        </Pressable>
      </View>
      {!isSignedIn && (
        <Text style={styles.hint}>sign in to see friend leaderboards</Text>
      )}
      {loading ? (
        <Text style={styles.muted}>loading…</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => (r.kind === "ad" ? r.key : r.entry.user_id)}
          renderItem={({ item }) => {
            if (item.kind === "ad") return <BannerAdSlot slot="leaderboard_banner" />;
            return (
              <LeaderboardRow
                rank={item.rank}
                handle={item.entry.handle}
                score={item.entry.score}
                locale={item.entry.locale}
              />
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>no entries yet</Text>}
          initialNumToRender={20}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000", paddingTop: 60 },
  tabs: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12 },
  tab: { paddingVertical: 8, paddingHorizontal: 12, marginRight: 8 },
  tabLabel: { color: "#888", fontSize: 14 },
  tabLabelActive: { color: "#aaff00", fontWeight: "700" },
  scopeRow: { flexDirection: "row", paddingHorizontal: 16, marginBottom: 12, gap: 16 },
  scopeBtn: { paddingVertical: 4 },
  scopeLabel: { color: "#666", fontSize: 13 },
  scopeLabelActive: { color: "#fff" },
  disabled: { color: "#444" },
  hint: { color: "#888", fontSize: 12, paddingHorizontal: 16, marginBottom: 8 },
  muted: { color: "#888", fontSize: 14, padding: 16, textAlign: "center" },
});
