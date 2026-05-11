// ios/src/components/ClusterBubble.tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { clusterSizeBucket, clusterSizePx } from "@/src/lib/clusterSizeBucket";
import { stickerRotation } from "@/src/lib/stickerRotation";

interface Props {
  id: string;
  text: string;
  count: number;
  maxCount: number;
  isSelf: boolean;
  /** index into the cluster list, used to rotate fill color deterministically */
  colorIndex: number;
}

const FILL_ROTATION = [palette.mint, palette.lemon, palette.blue, "#FFD7E8"] as const;

export function ClusterBubble({ id, text, count, maxCount, isSelf, colorIndex }: Props) {
  const bucket = clusterSizeBucket(count, maxCount);
  const fontSize = clusterSizePx(bucket);
  const angle = stickerRotation(id);

  const isLargeBucket = bucket === "xl" || bucket === "l" || bucket === "m";
  const borderWidth = bucket === "xs" || bucket === "s" ? 2 : 3;
  const shadowSpec = isSelf ? shadow.l : (isLargeBucket ? shadow.m : shadow.s);
  const radius = bucket === "xl" || bucket === "l" ? radii.l : radii.m;
  const fill = isSelf ? palette.pink : FILL_ROTATION[colorIndex % FILL_ROTATION.length];
  const fg = isSelf ? palette.cream : palette.ink;

  return (
    <View
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
          lineHeight: fontSize,
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
    </View>
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
