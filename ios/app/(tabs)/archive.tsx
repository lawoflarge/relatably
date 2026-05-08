import { View, Text, StyleSheet } from "react-native";

export default function ArchiveTab() {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>archive · coming in phase 5</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#000" },
  muted: { color: "#888", fontSize: 14 },
});
