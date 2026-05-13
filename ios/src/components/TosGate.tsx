import React, { useEffect, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { hasAcceptedTos, recordTosAcceptance } from "@/src/lib/eulaStore";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://relatably.vercel.app";

interface Props {
  children: React.ReactNode;
}

type Phase = "loading" | "blocking" | "ready";

/**
 * App Review Guideline 1.2 requires UGC apps to make users agree to terms
 * that prohibit objectionable content. This gate renders a full-screen
 * acceptance modal the first time the app is launched (and again whenever
 * CURRENT_TOS_VERSION in eulaStore.ts bumps).
 *
 * Acceptance is recorded with expo-secure-store so it persists across
 * launches and is per-device (not per-user — anonymous users also need
 * to agree).
 */
export function TosGate({ children }: Props): React.ReactElement {
  const [phase, setPhase] = useState<Phase>("loading");

  useEffect(() => {
    (async () => {
      try {
        const accepted = await hasAcceptedTos();
        setPhase(accepted ? "ready" : "blocking");
      } catch {
        // SecureStore unavailable — fail open and let the user in.
        setPhase("ready");
      }
    })();
  }, []);

  if (phase === "loading") {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>loading…</Text>
      </View>
    );
  }

  if (phase === "blocking") {
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Before you play</Text>
          <Text style={styles.body}>
            Relatably is a daily question app. Anyone can submit an answer, so
            we have a zero-tolerance rule about what you write:
          </Text>
          <View style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.bulletText}>No hate, harassment, threats, or slurs.</Text></View>
          <View style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.bulletText}>No sexual content involving minors. Ever.</Text></View>
          <View style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.bulletText}>No personal info about other people.</Text></View>
          <View style={styles.bulletRow}><Text style={styles.bullet}>•</Text><Text style={styles.bulletText}>No spam, scams, or attempts to game the wordcloud.</Text></View>
          <Text style={styles.body}>
            Anything else? Long-press an answer in the wordcloud to report it.
            We act on reports within 24 hours. Repeat offenders lose their
            account.
          </Text>
          <Text style={styles.smaller}>
            By tapping <Text style={{ fontFamily: typography.label.family }}>I AGREE</Text> you confirm
            you&apos;re 17 or older and you accept our{' '}
            <Text style={styles.link} onPress={() => Linking.openURL(`${BASE}/tos`)}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={styles.link} onPress={() => Linking.openURL(`${BASE}/privacy`)}>Privacy Policy</Text>.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="I agree to the terms"
            onPress={async () => {
              await recordTosAcceptance();
              setPhase("ready");
            }}
            style={styles.agreeBtn}
          >
            <Text style={styles.agreeText}>I AGREE</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center" },
  loadingText: { fontFamily: typography.bodyS.family, fontSize: 14, color: palette.inkSoft },
  root: { flex: 1, backgroundColor: palette.cream },
  content: { paddingTop: sp[8], paddingHorizontal: sp.gutter, paddingBottom: sp[8], gap: sp[3] },
  title: { fontFamily: typography.h1.family, fontSize: typography.h1.size, lineHeight: typography.h1.line, color: palette.ink, marginBottom: sp[2] },
  body: { fontFamily: typography.bodyL.family, fontSize: typography.bodyL.size, lineHeight: typography.bodyL.line, color: palette.ink },
  smaller: { fontFamily: typography.bodyS.family, fontSize: typography.bodyS.size, lineHeight: typography.bodyS.line, color: palette.inkSoft, marginTop: sp[3] },
  link: { color: palette.ink, textDecorationLine: "underline" },
  bulletRow: { flexDirection: "row", gap: sp[2] },
  bullet: { fontFamily: typography.bodyL.family, fontSize: typography.bodyL.size, color: palette.ink, width: 14, textAlign: "center" },
  bulletText: { flex: 1, fontFamily: typography.bodyL.family, fontSize: typography.bodyL.size, lineHeight: typography.bodyL.line, color: palette.ink },
  agreeBtn: {
    marginTop: sp[5],
    alignSelf: "center",
    paddingHorizontal: sp[6],
    paddingVertical: sp[3],
    borderRadius: radii.pill,
    backgroundColor: palette.pink,
    borderColor: palette.ink,
    borderWidth: 3,
    shadowColor: shadow.s.color,
    shadowOffset: shadow.s.offset,
    shadowRadius: shadow.s.radius,
    shadowOpacity: shadow.s.opacity,
    elevation: shadow.s.elevation,
  },
  agreeText: { fontFamily: typography.label.family, fontSize: 14, letterSpacing: 1.4, color: palette.cream },
});
