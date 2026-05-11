import React from "react";
import { TextInput, View, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { IconPeelCorner } from "@/src/components/icons";

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  editable?: boolean;
}

export function AnswerInput({ value, onChangeText, editable = true }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder="your take?"
        placeholderTextColor="rgba(26,26,26,0.45)"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={280}
        multiline={false}
        returnKeyType="send"
      />
      <View style={styles.peel}><IconPeelCorner size={22} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.ink,
    borderWidth: 3,
    borderRadius: radii.m,
    shadowColor: shadow.m.color,
    shadowOffset: shadow.m.offset,
    shadowRadius: shadow.m.radius,
    shadowOpacity: shadow.m.opacity,
    elevation: shadow.m.elevation,
    paddingVertical: sp[4] + 2,
    paddingHorizontal: sp[5],
    position: "relative",
  },
  input: {
    fontFamily: typography.bodyL.family,
    fontSize: typography.bodyL.size,
    color: palette.ink,
    paddingRight: 28,
  },
  peel: { position: "absolute", top: 0, right: 0 },
});
