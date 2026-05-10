import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { LeaderboardRow } from "@/src/components/LeaderboardRow";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";
import { fetchLeaderboard } from "@/src/lib/api";
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from "@/src/types/api";

interface Props {
  isSignedIn: boolean;
  currentUserId?: string;
}

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "DAILY" },
  { key: "weekly", label: "WEEKLY" },
  { key: "alltime", label: "ALL-TIME" },
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

export function LeaderboardScreen({ isSignedIn, currentUserId }: Props) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard({ period, scope })
      .then((res) => { if (!cancelled) setEntries(res.entries); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, scope]);

  const rows = interleaveAd(entries);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>the board ★</Text>
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={pillStyle(period === p.key)}>
            <Text style={pillTextStyle(period === p.key)}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scopeRow}>
        <Pressable onPress={() => setScope("global")} style={pillStyle(scope === "global")}>
          <Text style={pillTextStyle(scope === "global")}>GLOBAL</Text>
        </Pressable>
        <Pressable
          onPress={() => isSignedIn && setScope("friends")}
          disabled={!isSignedIn}
          style={[pillStyle(scope === "friends"), !isSignedIn && styles.disabled]}
        >
          <Text style={pillTextStyle(scope === "friends")}>FRIENDS</Text>
        </Pressable>
      </View>
      {!isSignedIn && <Text style={styles.hint}>sign in to see friend leaderboards</Text>}
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
                streakDays={(item.entry as LeaderboardEntry & { streak_days?: number }).streak_days ?? 0}
                isSelf={!!currentUserId && item.entry.user_id === currentUserId}
                crown={item.rank === 1}
              />
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>no entries yet</Text>}
          initialNumToRender={20}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
}

function pillStyle(active: boolean) {
  return {
    backgroundColor: active ? palette.blue : palette.cream,
    borderColor: palette.ink,
    borderWidth: 2,
    borderRadius: radii.pill,
    paddingHorizontal: sp[3],
    paddingVertical: sp[2],
    shadowColor: shadow.s.color,
    shadowOffset: shadow.s.offset,
    shadowRadius: shadow.s.radius,
    shadowOpacity: shadow.s.opacity,
    elevation: shadow.s.elevation,
  } as const;
}

function pillTextStyle(active: boolean) {
  return {
    fontFamily: typography.body.family,
    fontSize: 13,
    color: palette.ink,
    letterSpacing: 0.6,
    opacity: active ? 1 : 0.7,
  } as const;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream, paddingTop: sp[7], paddingHorizontal: sp.gutter },
  title: { fontFamily: typography.h2.family, fontSize: typography.h2.size, lineHeight: typography.h2.line, color: palette.ink, marginBottom: sp[4] },
  periodRow: { flexDirection: "row", gap: sp[2], marginBottom: sp[3] },
  scopeRow: { flexDirection: "row", gap: sp[2], marginBottom: sp[3] },
  disabled: { opacity: 0.5 },
  hint: { fontFamily: typography.label.family, fontSize: 12, color: palette.inkSoft, marginBottom: sp[3] },
  muted: { fontFamily: typography.label.family, fontSize: 14, color: palette.inkSoft, padding: sp[4], textAlign: "center" },
});
