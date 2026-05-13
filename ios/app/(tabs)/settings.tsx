import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { onAuthStateChanged } from "firebase/auth";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { PaperTexture } from "@/src/components/sticker/PaperTexture";
import { deleteAccount } from "@/src/lib/api";
import { signOut } from "@/src/lib/auth";
import { auth } from "@/src/lib/firebase";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://relatably.vercel.app";
const SUPPORT_EMAIL = "levin.schwab@gmx.de";

type Row = {
  label: string;
  hint?: string;
  onPress: () => void;
  destructive?: boolean;
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth(), (u) => setUid(u?.uid ?? null));
    return () => unsub();
  }, []);

  const open = (url: string) => () => {
    Linking.openURL(url).catch((err) => {
      Alert.alert("Couldn't open link", err instanceof Error ? err.message : String(err));
    });
  };

  const handleContact = () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Relatably support")}`;
    Linking.openURL(url).catch((err) => {
      Alert.alert("Couldn't open mail", err instanceof Error ? err.message : String(err));
    });
  };

  const handleReportInappropriate = () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Report inappropriate content / abusive user on Relatably")}&body=${encodeURIComponent(
      "Please describe what you'd like to report. We respond within 24 hours.\n\n",
    )}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(
        "Mail unavailable",
        `Please email ${SUPPORT_EMAIL} from any email app. We respond within 24 hours.`,
      );
    });
  };

  const handleSignOut = useCallback(async () => {
    Alert.alert("Sign out?", "Your device will go back to anonymous mode. Your data on the server stays put.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await signOut();
          } catch (err) {
            Alert.alert("Couldn't sign out", err instanceof Error ? err.message : String(err));
          }
        },
      },
    ]);
  }, []);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      "Delete your account?",
      "This permanently removes your profile, leaderboard entries, and friend graph, and revokes your Sign in with Apple link to Relatably. Past answers are anonymised but stay in the wordcloud. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              try {
                await signOut();
              } catch {
                /* already-deleted -> fine */
              }
              Alert.alert("Account deleted", "Your account and personal data have been removed from Relatably.");
            } catch (err) {
              Alert.alert(
                "Couldn't delete account",
                err instanceof Error ? err.message : "please try again or email " + SUPPORT_EMAIL,
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, []);

  const rows: Row[] = [
    { label: "Contact support", hint: SUPPORT_EMAIL, onPress: handleContact },
    { label: "Report inappropriate content", hint: "We act within 24 hours", onPress: handleReportInappropriate },
    { label: "Terms of Service", onPress: open(`${BASE}/tos`) },
    { label: "Privacy Policy", onPress: open(`${BASE}/privacy`) },
  ];

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <PaperTexture />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + sp[5] }]}>
        <Text style={styles.title}>Settings</Text>

        <View style={styles.card}>
          {rows.map((row, i) => (
            <Pressable
              key={row.label}
              accessibilityRole="button"
              onPress={row.onPress}
              style={[styles.row, i < rows.length - 1 && styles.rowDivider]}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                {row.hint ? <Text style={styles.rowHint}>{row.hint}</Text> : null}
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          ))}
        </View>

        {uid ? (
          <>
            <Text style={styles.sectionLabel}>ACCOUNT</Text>
            <View style={styles.card}>
              <Pressable
                accessibilityRole="button"
                onPress={handleSignOut}
                style={[styles.row, styles.rowDivider]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowLabel}>Sign out</Text>
                  <Text style={styles.rowHint}>Stay anonymous on this device</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Delete account"
                disabled={busy}
                onPress={handleDeleteAccount}
                style={styles.row}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, styles.destructiveLabel]}>
                    {busy ? "Deleting…" : "Delete account"}
                  </Text>
                  <Text style={styles.rowHint}>Permanent. Can&apos;t be undone.</Text>
                </View>
                <Text style={[styles.chevron, styles.destructiveLabel]}>›</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.signedOutHint}>
            <Text style={styles.rowHint}>
              You&apos;re playing anonymously. Sign in with Apple from the Friends tab to unlock the leaderboard.
            </Text>
          </View>
        )}

        <Text style={styles.footer}>© 2026 Levin Schwab · v1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream },
  content: { paddingHorizontal: sp.gutter, paddingBottom: 120, gap: sp[4] },
  title: { fontFamily: typography.h1.family, fontSize: typography.h1.size, lineHeight: typography.h1.line, color: palette.ink, marginBottom: sp[2] },
  sectionLabel: {
    marginTop: sp[2],
    fontFamily: typography.label.family,
    fontSize: 11,
    letterSpacing: 1.4,
    color: palette.inkSoft,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.ink,
    borderWidth: 3,
    borderRadius: radii.m,
    shadowColor: shadow.s.color,
    shadowOffset: shadow.s.offset,
    shadowRadius: shadow.s.radius,
    shadowOpacity: shadow.s.opacity,
    elevation: shadow.s.elevation,
  },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: sp[4], paddingVertical: sp[4] },
  rowDivider: { borderBottomColor: palette.ink, borderBottomWidth: 2 },
  rowLabel: { fontFamily: typography.bodyL.family, fontSize: typography.bodyL.size, color: palette.ink },
  rowHint: { marginTop: 2, fontFamily: typography.bodyS.family, fontSize: typography.bodyS.size, color: palette.inkSoft },
  chevron: { fontFamily: typography.h2.family, fontSize: 24, color: palette.ink, marginLeft: sp[2] },
  destructiveLabel: { color: palette.red },
  signedOutHint: { paddingHorizontal: sp[2], paddingVertical: sp[2] },
  footer: { marginTop: sp[5], textAlign: "center", fontFamily: typography.bodyS.family, fontSize: typography.bodyS.size, color: palette.inkSoft },
});
