import { Tabs } from "expo-router";
import React from "react";

import { StickerTabBar } from "@/components/StickerTabBar";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <StickerTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Board" }} />
      <Tabs.Screen name="archive" options={{ title: "Archive" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      {/* archive/[id] is reached via router.push from ArchiveTab — hide from tab bar */}
      <Tabs.Screen name="archive/[id]" options={{ href: null }} />
    </Tabs>
  );
}
