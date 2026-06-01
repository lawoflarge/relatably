import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedStyle, Easing } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { palette, radii, shadow, sp, typography, motion } from "@/src/theme/tokens";

interface Props {
  hasText: boolean;
  onPress: () => void;
  startedAt: number;
}

const MIN_DWELL_MS = 3000;
const APress = Animated.createAnimatedComponent(Pressable);

export function SubmitButton({ hasText, onPress, startedAt }: Props) {
  const [dwellMet, setDwellMet] = useState(false);
  const angle = useSharedValue(-2);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const enabled = dwellMet && hasText;

  useEffect(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= MIN_DWELL_MS) { setDwellMet(true); return; }
    const t = setTimeout(() => setDwellMet(true), MIN_DWELL_MS - elapsed);
    return () => clearTimeout(t);
  }, [startedAt]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }, { translateX: tx.value }, { translateY: ty.value }],
  }));

  function handlePressIn() {
    angle.value = withTiming(0, { duration: motion.tap.duration, easing: Easing.out(Easing.ease) });
    tx.value = withTiming(2, { duration: motion.tap.duration });
    ty.value = withTiming(2, { duration: motion.tap.duration });
  }
  function handlePressOut() {
    angle.value = withTiming(-2, { duration: motion.spring.duration });
    tx.value = withSequence(withTiming(0, { duration: motion.spring.duration }));
    ty.value = withSequence(withTiming(0, { duration: motion.spring.duration }));
  }

  function handlePress() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onPress();
  }

  const shadowSpec = enabled ? shadow.l : shadow.s;

  return (
    <View style={styles.wrap}>
      <APress
        role="button"
        accessibilityState={{ disabled: !enabled }}
        disabled={!enabled}
        onPressIn={enabled ? handlePressIn : undefined}
        onPressOut={enabled ? handlePressOut : undefined}
        onPress={enabled ? handlePress : undefined}
        style={[
          styles.btn,
          {
            backgroundColor: enabled ? palette.pink : palette.cream2,
            opacity: enabled ? 1 : 0.92,
            shadowColor: shadowSpec.color,
            shadowOffset: shadowSpec.offset,
            shadowRadius: shadowSpec.radius,
            shadowOpacity: shadowSpec.opacity,
            elevation: shadowSpec.elevation,
          },
          animatedStyle,
        ]}
      >
        <Text style={[styles.label, { color: enabled ? palette.cream : palette.inkSoft }]}>DROP IT</Text>
      </APress>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  btn: {
    borderColor: palette.ink,
    borderWidth: 3,
    borderRadius: radii.l,
    paddingVertical: sp[4] + 2,
    paddingHorizontal: sp[5] + sp[1],
    alignSelf: "center",
  },
  label: { fontFamily: typography.h3.family, fontSize: 22 },
});
