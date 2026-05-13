import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";

type RouteName = "index" | "friends" | "leaderboard" | "archive" | "settings";

// Whitelist of routes that get a tab pill. Expo-router auto-discovers
// every file in (tabs)/ including the nested archive/[id] dynamic route,
// and `<Tabs.Screen options={{ href: null }} />` only suppresses items
// from the DEFAULT React Navigation tab bar — custom tab bars (this
// component) get every route in state.routes regardless. Build 25
// shipped with archive/[id] visible as a phantom "ARCHIVE/[ID]" tab.
const VISIBLE: ReadonlySet<RouteName> = new Set([
  "index",
  "friends",
  "leaderboard",
  "archive",
  "settings",
]);

// Unicode glyphs instead of react-native-svg icons. The svg package
// downgrade (15.15 -> 15.12 to match Expo SDK 54) was leaving one of
// the IconHome/Friends/Board/Archive imports as undefined at runtime,
// which crashed StickerTabBar with "Element type is invalid... got:
// undefined". Glyphs render via plain <Text> -> zero native deps.
const GLYPHS: Record<RouteName, string> = {
  index: "■",       // TODAY  (filled square — "drop")
  friends: "♥",     // FRIENDS
  leaderboard: "★", // BOARD
  archive: "▦",     // ARCHIVE (grid)
  settings: "⚙",    // SETTINGS (gear)
};

const LABELS: Record<RouteName, string> = {
  index: "TODAY",
  friends: "FRIENDS",
  leaderboard: "BOARD",
  archive: "ARCHIVE",
  settings: "ME",
};

interface Props {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit?: (...args: any[]) => any };
  descriptors: Record<string, { options: { title?: string } }>;
  insets: { bottom: number };
}

export function StickerTabBar({ state, navigation, insets }: Props) {
  // Tighter bottom padding so the pill hugs the home indicator instead of
  // floating with a goofy 30-40pt cream gap below it (build 25 issue).
  // Home indicator is ~34pt; keep ~8pt clearance so the gesture handle
  // doesn't visually overlap the pill border.
  const bottomPad = insets.bottom > 0 ? 8 : 12;
  return (
    <View style={[styles.outer, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes
          .map((route, i) => ({ route, originalIndex: i }))
          .filter(({ route }) => VISIBLE.has(route.name as RouteName))
          .map(({ route, originalIndex }) => {
            const i = originalIndex;
            const name = route.name as RouteName;
            const isActive = state.index === i;
            const glyph = GLYPHS[name] ?? "•";
            const label = LABELS[name] ?? route.name.toUpperCase();
            return (
            <Pressable
              key={route.key}
              role="button"
              onPress={() => {
                if (!isActive) {
                  try { Haptics.selectionAsync().catch(() => {}); } catch { /* noop */ }
                  navigation.navigate(name);
                }
              }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.glyph, { color: isActive ? palette.cream : palette.ink }]}>{glyph}</Text>
              <Text style={[styles.label, { color: isActive ? palette.cream : palette.ink }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingHorizontal: sp.gutter },
  bar: {
    flexDirection: "row",
    backgroundColor: palette.cream,
    borderColor: palette.ink,
    borderWidth: 3,
    borderRadius: radii.pill,
    paddingHorizontal: sp[1],
    paddingVertical: sp[1],
    gap: sp[1],
    shadowColor: shadow.m.color,
    shadowOffset: shadow.m.offset,
    shadowRadius: shadow.m.radius,
    shadowOpacity: shadow.m.opacity,
    elevation: shadow.m.elevation,
  },
  tab: { paddingHorizontal: sp[3], paddingVertical: sp[2], borderRadius: radii.pill, alignItems: "center", gap: 2, minWidth: 64 },
  tabActive: { backgroundColor: palette.ink },
  glyph: { fontSize: 18, lineHeight: 20 },
  label: { fontFamily: typography.micro.family, fontSize: typography.micro.size, letterSpacing: 1.3 },
});
