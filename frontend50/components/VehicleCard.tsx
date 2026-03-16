import { View, Text, StyleSheet } from "react-native";

export default function VehicleCard({ name, year, mileage }) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{name}</Text>
      <Text style={styles.detail}>Year: {year}</Text>
      <Text style={styles.detail}>Mileage: {mileage} miles</Text>
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
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
  },
  detail: {
    marginTop: 4,
    color: "#9ca3af",
  },
});