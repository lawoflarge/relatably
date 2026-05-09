import { View, StyleSheet } from "react-native";
import { isAdsEnabled, getAdUnitId } from "@/src/lib/ads";

interface Props {
  slot: "leaderboard_banner" | "archive_banner";
}

export function BannerAdSlot({ slot }: Props) {
  if (!isAdsEnabled()) {
    return <View testID="banner-ad-slot-disabled" style={styles.placeholder} />;
  }
  // Lazy-loaded only when ads enabled — keeps test env clean.
  const { BannerAd, BannerAdSize } = require("react-native-google-mobile-ads");
  return (
    <View style={styles.container}>
      <BannerAd
        unitId={getAdUnitId(slot)}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingVertical: 4, backgroundColor: "#000" },
  placeholder: { height: 50, backgroundColor: "#0a0a0a", marginVertical: 4 },
});
