// ios/src/components/ClusterBubble.tsx
import React from "react";
import { Text, View, StyleSheet, Pressable, ActionSheetIOS, Alert, Platform } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { clusterSizeBucket, clusterSizePx } from "@/src/lib/clusterSizeBucket";
import { stickerRotation } from "@/src/lib/stickerRotation";
import { reportContent } from "@/src/lib/api";
import { getDeviceToken } from "@/src/lib/deviceId";
import { hideCluster } from "@/src/lib/hiddenContentStore";

interface Props {
  id: string;
  text: string;
  count: number;
  maxCount: number;
  isSelf: boolean;
  /** index into the cluster list, used to rotate fill color deterministically */
  colorIndex: number;
  /**
   * Called after the user picks "Hide this answer". Parent should remove the
   * cluster from view immediately (App Review Guideline 1.2 requires that
   * objectionable UGC can be removed from the feed in real time).
   */
  onHide?: (id: string, text: string) => void;
}

const FILL_ROTATION = [palette.mint, palette.lemon, palette.blue, "#FFD7E8"] as const;

export function ClusterBubble({ id, text, count, maxCount, isSelf, colorIndex, onHide }: Props) {
  const bucket = clusterSizeBucket(count, maxCount);
  const fontSize = clusterSizePx(bucket);
  const angle = stickerRotation(id);

  const isLargeBucket = bucket === "xl" || bucket === "l" || bucket === "m";
  const borderWidth = bucket === "xs" || bucket === "s" ? 2 : 3;
  const shadowSpec = isSelf ? shadow.l : (isLargeBucket ? shadow.m : shadow.s);
  const radius = bucket === "xl" || bucket === "l" ? radii.l : radii.m;
  const fill = isSelf ? palette.pink : FILL_ROTATION[colorIndex % FILL_ROTATION.length];
  const fg = isSelf ? palette.cream : palette.ink;

  const handleHide = async () => {
    try {
      await hideCluster({ id, text });
      onHide?.(id, text);
    } catch (err) {
      Alert.alert("Couldn't hide", err instanceof Error ? err.message : String(err));
    }
  };

  const handleReport = async () => {
    try {
      const deviceToken = await getDeviceToken();
      await reportContent({ target_type: "cluster", target_id: id, device_token: deviceToken });
      // Also hide locally so the reporter doesn't have to keep seeing it
      // while the report is reviewed.
      await hideCluster({ id, text });
      onHide?.(id, text);
      Alert.alert("Thanks for reporting", "We removed it from your feed and will review within 24 hours.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "report failed";
      Alert.alert("Couldn't report", msg);
    }
  };

  const handleLongPress = () => {
    // Don't let the user hide their own answer here — they have a dedicated
    // "DELETE MY ANSWER" affordance on the wordcloud (server-side delete).
    if (isSelf) return;
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ["Cancel", "Hide this answer", "Report this answer"],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 0,
          title: `"${text}"`,
        },
        (index) => {
          if (index === 1) handleHide();
          if (index === 2) handleReport();
        },
      );
    } else {
      Alert.alert(
        `"${text}"`,
        "Remove from your feed or report it? Reports are reviewed within 24 hours.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Hide", onPress: handleHide },
          { text: "Report", style: "destructive", onPress: handleReport },
        ],
      );
    }
  };

  return (
    <Pressable
      onLongPress={handleLongPress}
      accessibilityLabel={`${text}, long-press to hide or report`}
      accessibilityHint="Long-press to hide this answer from your feed or report it"
      style={[
        styles.wrap,
        {
          backgroundColor: fill,
          borderColor: palette.ink,
          borderWidth,
          borderRadius: radius,
          shadowColor: shadowSpec.color,
          shadowOffset: shadowSpec.offset,
          shadowRadius: shadowSpec.radius,
          shadowOpacity: shadowSpec.opacity,
          elevation: shadowSpec.elevation,
          paddingVertical: bucket === "xl" ? sp[3] : sp[2],
          paddingHorizontal: bucket === "xl" ? sp[4] : sp[3],
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    >
      <Text
        style={{
          fontFamily: typography.h3.family,
          fontSize,
          // BagelFatOne clips its top at lineHeight == fontSize; give headroom.
          lineHeight: Math.round(fontSize * 1.2),
          color: fg,
        }}
      >
        {text}
      </Text>
      {isSelf && (
        <View style={styles.youTab}>
          <Text style={styles.youText}>YOU</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", position: "relative" },
  youTab: {
    position: "absolute",
    top: -12,
    left: -10,
    backgroundColor: palette.lemon2,
    borderColor: palette.ink,
    borderWidth: 2,
    borderRadius: radii.s,
    paddingHorizontal: sp[2],
    paddingVertical: 2,
    transform: [{ rotate: "-12deg" }],
  },
  youText: { fontFamily: typography.micro.family, fontSize: 10, color: palette.ink, letterSpacing: 1.4 },
});
