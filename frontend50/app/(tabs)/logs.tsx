import { View, Text, StyleSheet } from "react-native";

export default function Logs() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Logs</Text>
      <Text style={styles.subtitle}>Your maintenance logs will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111827",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "white",
  },
  subtitle: {
    marginTop: 10,
    fontSize: 16,
    color: "#9ca3af",
  },
});