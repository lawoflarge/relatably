import React from "react";
import { Text, StyleSheet } from "react-native";
import { palette, typography } from "@/src/theme/tokens";

export function QuestionText({ text }: { text: string }) {
  return <Text style={styles.text}>{text.toLowerCase()}</Text>;
}
const styles = StyleSheet.create({
  text: { fontFamily: typography.hero.family, fontSize: typography.hero.size, lineHeight: typography.hero.line, color: palette.ink },
});
