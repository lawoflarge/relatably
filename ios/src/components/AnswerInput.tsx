import { TextInput, StyleSheet } from "react-native";

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  editable?: boolean;
}

export function AnswerInput({ value, onChangeText, editable = true }: Props) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder="type your take…"
      placeholderTextColor="#666"
      editable={editable}
      autoCapitalize="none"
      autoCorrect={false}
      maxLength={280}
      multiline={false}
      returnKeyType="send"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "500",
    borderBottomColor: "#aaff00",
    borderBottomWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 32,
  },
});
