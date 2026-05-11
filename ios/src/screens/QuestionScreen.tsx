import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Text, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, typography } from "@/src/theme/tokens";
import { PaperTexture } from "@/src/components/sticker/PaperTexture";
import { QuestionText } from "@/src/components/QuestionText";
import { AnswerInput } from "@/src/components/AnswerInput";
import { LiveCounter } from "@/src/components/LiveCounter";
import { fetchTodayQuestion } from "@/src/lib/api";
import type { TodayQuestion } from "@/src/types/api";

interface Props { onSubmit: (question: TodayQuestion, text: string, dwellMs: number) => void }

export function QuestionScreen({ onSubmit }: Props) {
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [text, setText] = useState("");
  const [renderedAt] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayQuestion().then(setQuestion).catch((e) => setError(e.message));
  }, []);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!question) return <View style={styles.center}><ActivityIndicator color={palette.pink} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <PaperTexture />
      <View style={styles.datePill}><Text style={styles.dateText}>TODAY'S DROP ★</Text></View>
      <View style={{ height: sp[4] }} />
      <QuestionText text={question.text} />
      <View style={{ height: sp[4] }} />
      <LiveCounter count={0 /* wired by parent in tabs/index.tsx */} />
      <View style={{ height: sp[5] }} />
      <AnswerInput value={text} onChangeText={setText} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream },
  content: { paddingTop: sp[7], paddingHorizontal: sp.gutter, paddingBottom: 120 },
  center: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center" },
  error: { color: palette.red, fontFamily: typography.bodyL.family, fontSize: 16, textAlign: "center" },
  datePill: {
    alignSelf: "flex-start",
    backgroundColor: palette.lemon, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s,
    paddingHorizontal: sp[3], paddingVertical: sp[1] + 2,
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
    transform: [{ rotate: "-1.5deg" }],
  },
  dateText: { fontFamily: typography.label.family, fontSize: 11, letterSpacing: 1.4, color: palette.ink },
});
