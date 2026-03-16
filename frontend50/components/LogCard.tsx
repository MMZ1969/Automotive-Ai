import { View, Text, StyleSheet } from "react-native";

export default function LogCard({ title, date, cost }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.detail}>Date: {date}</Text>
      <Text style={styles.detail}>Cost: ${cost}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1f2937",
    padding: 16,
    borderRadius: 10,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#374151",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  detail: {
    marginTop: 4,
    color: "#9ca3af",
  },
});