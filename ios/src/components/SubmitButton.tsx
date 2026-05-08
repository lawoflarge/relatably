import { useEffect, useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";

interface Props {
  hasText: boolean;
  onPress: () => void;
  startedAt: number;
}

const MIN_DWELL_MS = 3000;

export function SubmitButton({ hasText, onPress, startedAt }: Props) {
  const [dwellMet, setDwellMet] = useState(false);

  useEffect(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= MIN_DWELL_MS) {
      setDwellMet(true);
      return;
    }
    const t = setTimeout(() => setDwellMet(true), MIN_DWELL_MS - elapsed);
    return () => clearTimeout(t);
  }, [startedAt]);

  const enabled = dwellMet && hasText;

  return (
    <Pressable
      role="button"
      accessibilityState={{ disabled: !enabled }}
      onPress={enabled ? onPress : undefined}
      style={[styles.btn, enabled ? styles.btnOn : styles.btnOff]}
    >
      <Text style={styles.label}>SUBMIT</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 32,
    marginHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOn: { backgroundColor: "#aaff00" },
  btnOff: { backgroundColor: "#222" },
  label: {
    color: "#000",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
});
