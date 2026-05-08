import { useEffect, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WordcloudScreen, type Cluster } from "@/src/screens/WordcloudScreen";
import { SubmitButton } from "@/src/components/SubmitButton";
import { QuestionText } from "@/src/components/QuestionText";
import { AnswerInput } from "@/src/components/AnswerInput";
import { LiveCounter } from "@/src/components/LiveCounter";
import { fetchTodayQuestion, submitAnswer } from "@/src/lib/api";
import { getDeviceToken } from "@/src/lib/deviceId";
import { firestore } from "@/src/lib/firebase";
import type { TodayQuestion } from "@/src/types/api";

type Phase = "loading" | "question" | "wordcloud" | "error";

export default function HomeScreen() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [text, setText] = useState("");
  const [renderedAt, setRenderedAt] = useState(Date.now());
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [selfClusterId, setSelfClusterId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load today's question
  useEffect(() => {
    fetchTodayQuestion()
      .then((q) => {
        setQuestion(q);
        setRenderedAt(Date.now());
        setPhase("question");
      })
      .catch((e) => {
        setErrorMsg(e.message);
        setPhase("error");
      });
  }, []);

  // Subscribe to Firestore listener for live cluster updates
  useEffect(() => {
    if (!question) return;
    const unsub = firestore()
      .collection("answer_clusters")
      .where("question_id", "==", question.id)
      .orderBy("submission_count", "desc")
      .limit(100)
      .onSnapshot(
        (snap) => {
          const next: Cluster[] = snap.docs.map((d) => {
            const data = d.data() as {
              canonical_text: string;
              submission_count: number;
            };
            return {
              id: d.id,
              canonical_text: data.canonical_text,
              submission_count: data.submission_count,
            };
          });
          setClusters(next);
        },
        (err) => {
          console.warn("clusters listener error", err);
        },
      );
    return () => unsub();
  }, [question]);

  const handleSubmit = async () => {
    if (!question) return;
    try {
      const dwellMs = Date.now() - renderedAt;
      const deviceToken = await getDeviceToken();
      const result = await submitAnswer({
        question_id: question.id,
        device_token: deviceToken,
        raw_text: text,
        dwell_ms: dwellMs,
      });
      setSelfClusterId(result.cluster_id);
      setPhase("wordcloud");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "submit failed";
      setErrorMsg(msg);
    }
  };

  const totalCount = clusters.reduce((s, c) => s + c.submission_count, 0);

  return (
    <>
      <StatusBar style="light" />
      {phase === "loading" && (
        <View style={styles.center}>
          <Text style={styles.muted}>loading…</Text>
        </View>
      )}
      {phase === "error" && (
        <View style={styles.center}>
          <Text style={styles.error}>{errorMsg}</Text>
        </View>
      )}
      {phase === "question" && question && (
        <View style={styles.container}>
          <QuestionText text={question.text} />
          <AnswerInput value={text} onChangeText={setText} />
          <LiveCounter count={totalCount} />
          {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
          <SubmitButton
            hasText={text.trim().length > 0}
            onPress={handleSubmit}
            startedAt={renderedAt}
          />
        </View>
      )}
      {phase === "wordcloud" && (
        <WordcloudScreen
          clusters={clusters}
          selfClusterId={selfClusterId}
          totalCount={totalCount}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000", paddingTop: 80, paddingHorizontal: 16 },
  center: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  muted: { color: "#888", fontSize: 16 },
  error: { color: "tomato", fontSize: 14, textAlign: "center", marginTop: 12 },
});
