import { View, Text, StyleSheet } from "react-native";

interface Props {
  questionText: string;
  userAnswer: string;
  date: string;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const ACCENT = "#aaff00";

export function ShareCardTodaysTake({ questionText, userAnswer, date }: Props) {
  return (
    <View testID="share-card-todays-take" style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.brand}>RELATABLY</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      <Text style={styles.question}>{questionText}</Text>
      <View style={styles.answerBox}>
        <Text style={styles.answerText}>{userAnswer.toUpperCase()}</Text>
      </View>
      <Text style={styles.tagline}>I said this. The world is voting now.</Text>
      <Text style={styles.cta}>drop @ random — every day. 🌍</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: "#000", padding: 96, justifyContent: "space-between" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { color: "#fff", fontSize: 56, fontWeight: "900", letterSpacing: 2 },
  date: { color: "#888", fontSize: 36, fontWeight: "600" },
  question: { color: "#fff", fontSize: 64, fontWeight: "800", lineHeight: 80, marginTop: 96 },
  answerBox: { borderColor: ACCENT, borderWidth: 6, padding: 64, alignItems: "center", justifyContent: "center", borderRadius: 32 },
  answerText: { color: ACCENT, fontSize: 96, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  tagline: { color: "#fff", fontSize: 40, fontWeight: "600", textAlign: "center" },
  cta: { color: "#888", fontSize: 36, textAlign: "center" },
});
