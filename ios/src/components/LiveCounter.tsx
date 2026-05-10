import React from "react";
import { Text, StyleSheet } from "react-native";
import { palette, typography } from "@/src/theme/tokens";

export function LiveCounter({ count }: { count: number }) {
  return <Text style={styles.text}>{count.toLocaleString()} VOTES AND COUNTING</Text>;
}
const styles = StyleSheet.create({
  text: { fontFamily: typography.label.family, fontSize: typography.label.size, letterSpacing: 1.4, color: palette.inkSoft, textAlign: "center" },
});
