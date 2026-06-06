import { useTheme } from "@context/ThemeContext";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function LogCard({ log, onPress }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {log.vehicle && (
          <Text style={{ fontSize: 12, fontWeight: "700", color: colors.blue, marginBottom: 6, letterSpacing: 0.5 }}>
            🚗 {log.vehicle.year} {log.vehicle.make} {log.vehicle.model}
          </Text>
        )}
        <Text style={[styles.title, { color: colors.text }]}>{log.title ?? "Untitled"}</Text>
        {log.performedAt ? (
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            📅 {new Date(log.performedAt).toLocaleDateString()}
          </Text>
        ) : null}
        {log.cost != null ? (
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            💰 ${parseFloat(String(log.cost)).toFixed(2)}
          </Text>
        ) : null}
        {log.mileage != null ? (
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            🛣 {Number(log.mileage).toLocaleString()} miles
          </Text>
        ) : null}
        {log.description ? (
          <Text style={[styles.notes, { color: colors.textSecondary }]} numberOfLines={2}>
            {log.description}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 14,
    marginVertical: 8,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
  },
  detail: {
    marginTop: 6,
    fontSize: 14,
  },
  notes: {
    marginTop: 6,
    fontSize: 13,
    fontStyle: "italic",
  },
});