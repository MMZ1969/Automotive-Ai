import { TextInput, StyleSheet } from "react-native";

export default function Input(props) {
  return (
    <TextInput
      placeholderTextColor="#6b7280"
      style={styles.input}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: "#1f2937",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginVertical: 8,
  },
});