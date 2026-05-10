import { useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { signInWithApple } from "@/src/lib/auth";

interface Props {
  onSignedIn: (uid: string) => void;
  onError?: (err: unknown) => void;
}

export function SignInWithApple({ onSignedIn, onError }: Props) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { uid } = await signInWithApple();
      onSignedIn(uid);
    } catch (err) {
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable role="button" onPress={handlePress} style={[styles.btn, busy && styles.busy]}>
      <Text style={styles.label}>{busy ? "signing in…" : "SIGN IN WITH APPLE"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: palette.ink, borderColor: palette.ink, borderWidth: 3, borderRadius: radii.l,
    paddingHorizontal: sp[5], paddingVertical: sp[3] + 2,
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
    alignItems: "center", alignSelf: "center",
  },
  busy: { opacity: 0.4 },
  label: { fontFamily: typography.h3.family, fontSize: 16, color: palette.cream, letterSpacing: 1 },
});
