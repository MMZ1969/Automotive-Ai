import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LogCard({ log, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.card}>
        <Text style={styles.title}>{log.title ?? "Untitled"}</Text>
        {log.performedAt ? (
          <Text style={styles.detail}>
            📅 {new Date(log.performedAt).toLocaleDateString()}
          </Text>
        ) : null}
        {log.cost != null ? (
          <Text style={styles.detail}>
            💰 ${parseFloat(String(log.cost)).toFixed(2)}
          </Text>
        ) : null}
        {log.mileage != null ? (
          <Text style={styles.detail}>
            🛣 {Number(log.mileage).toLocaleString()} miles
          </Text>
        ) : null}
        {log.description ? (
          <Text style={styles.notes} numberOfLines={2}>
            {log.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#11131a",
    padding: 16,
    borderRadius: 14,
    marginVertical: 8,
    borderWidth: 1,
    borderColor: "#252838",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  detail: {
    marginTop: 6,
    color: "#9ca3af",
    fontSize: 14,
  },
  notes: {
    marginTop: 6,
    color: "#6b7280",
    fontSize: 13,
    fontStyle: "italic",
  },
});