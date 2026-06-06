import { useTheme } from "@context/ThemeContext";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function VehicleCard({ vehicle, onPress }) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>

        {vehicle.trim && (
          <Text style={[styles.trim, { color: colors.textSecondary }]}>{vehicle.trim}</Text>
        )}

        {/* Engine row */}
        {(vehicle.engine || vehicle.displacement) && (
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            🔧 {[vehicle.engine, vehicle.displacement ? `${vehicle.displacement}L` : null].filter(Boolean).join(" · ")}
          </Text>
        )}

        {vehicle.driveType && (
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            ⚙️ {vehicle.driveType}
          </Text>
        )}

        {vehicle.mileage && (
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            🛣 {vehicle.mileage.toLocaleString()} miles
          </Text>
        )}

        {vehicle.color && (
          <Text style={[styles.detail, { color: colors.textSecondary }]}>
            🎨 {vehicle.color}
          </Text>
        )}
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
    fontSize: 20,
    fontWeight: "bold",
  },
  trim: {
    fontSize: 14,
    marginTop: 2,
  },
  detail: {
    marginTop: 6,
    fontSize: 14,
  },
});