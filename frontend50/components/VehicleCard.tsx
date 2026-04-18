import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function VehicleCard({ vehicle, onPress }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.card}>
        <Text style={styles.title}>
          {vehicle.year} {vehicle.make} {vehicle.model}
        </Text>
        {vehicle.trim && (
          <Text style={styles.trim}>{vehicle.trim}</Text>
        )}
        {vehicle.mileage && (
          <Text style={styles.detail}>🛣 {vehicle.mileage.toLocaleString()} miles</Text>
        )}
        {vehicle.color && (
          <Text style={styles.detail}>🎨 {vehicle.color}</Text>
        )}
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
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  trim: {
    fontSize: 14,
    color: "#6b7280",
    marginTop: 2,
  },
  detail: {
    marginTop: 6,
    color: "#9ca3af",
    fontSize: 14,
  },
});