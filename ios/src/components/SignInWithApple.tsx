import { useState } from "react";
import { Pressable, Text, StyleSheet } from "react-native";
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
      <Text style={styles.label}>{busy ? "signing in…" : "  Sign in with Apple"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: { opacity: 0.6 },
  label: { color: "#000", fontSize: 16, fontWeight: "600" },
});
