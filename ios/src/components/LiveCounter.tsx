import { Text, StyleSheet } from "react-native";

export function LiveCounter({ count }: { count: number }) {
  return (
    <Text style={styles.text}>{count.toLocaleString()} answers so far</Text>
  );
}

const styles = StyleSheet.create({
  text: {
    color: "#888",
    fontSize: 14,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 12,
  },
});
