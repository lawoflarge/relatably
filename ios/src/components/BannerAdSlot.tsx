import { View, StyleSheet } from "react-native";
import { isAdsEnabled, getAdUnitId } from "@/src/lib/ads";

interface Props {
  slot: "leaderboard_banner" | "archive_banner";
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BannerAdSlot({ slot: _slot }: Props) {
  // v1.0 ships without AdMob; isAdsEnabled() is hard-gated to false.
  // Reintroduce real banner in v1.0.1.
  void getAdUnitId; // keep ads.ts API in scope for v1.0.1
  if (!isAdsEnabled()) {
    return <View testID="banner-ad-slot-disabled" style={styles.placeholder} />;
  }
  return <View testID="banner-ad-slot-disabled" style={styles.placeholder} />;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 4, backgroundColor: "#000" },
  placeholder: { height: 50, backgroundColor: "#0a0a0a", marginVertical: 4 },
});
