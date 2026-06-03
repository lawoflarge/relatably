// ios/src/components/ClusterBubble.tsx
import React from "react";
import { Text, View, StyleSheet, Pressable } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { clusterSizeBucket, clusterSizePx } from "@/src/lib/clusterSizeBucket";
import { stickerRotation } from "@/src/lib/stickerRotation";
import { openClusterModerationSheet } from "@/src/lib/clusterModeration";

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

  // Tap OR long-press opens the moderation sheet so the control is easy to
  // find (App Review Guideline 1.2 — a hidden long-press is not discoverable).
  // The user's own answer is excluded because it has a dedicated
  // "DELETE MY ANSWER" affordance on the wordcloud (server-side delete).
  const openModeration = () => {
    if (isSelf) return;
    openClusterModerationSheet(id, text, onHide);
  };

  return (
    <Pressable
      onPress={openModeration}
      onLongPress={openModeration}
      accessibilityLabel={isSelf ? text : `${text}, tap to hide or report`}
      accessibilityHint={isSelf ? undefined : "Tap or long-press to hide this answer from your feed or report it"}
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
