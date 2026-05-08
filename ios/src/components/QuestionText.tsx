import { Text, StyleSheet } from "react-native";

export function QuestionText({ text }: { text: string }) {
  return <Text style={styles.text}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 40,
    textAlign: "center",
    paddingHorizontal: 24,
  },
});
