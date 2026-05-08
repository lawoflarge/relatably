import { useEffect, useState } from "react";
import { View, StyleSheet, ActivityIndicator, Text } from "react-native";
import { QuestionText } from "../components/QuestionText";
import { AnswerInput } from "../components/AnswerInput";
import { LiveCounter } from "../components/LiveCounter";
import { fetchTodayQuestion } from "../lib/api";
import type { TodayQuestion } from "../types/api";

export function QuestionScreen({
  onSubmit,
}: {
  onSubmit: (question: TodayQuestion, text: string, dwellMs: number) => void;
}) {
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [text, setText] = useState("");
  const [renderedAt] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayQuestion()
      .then(setQuestion)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!question) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color="#aaff00" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <QuestionText text={question.text} />
      <AnswerInput value={text} onChangeText={setText} />
      <LiveCounter count={0 /* wired up in Task 15 */} />
      {/* SubmitButton wired in Task 13 + 15 */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  error: { color: "tomato", fontSize: 16, textAlign: "center" },
});
