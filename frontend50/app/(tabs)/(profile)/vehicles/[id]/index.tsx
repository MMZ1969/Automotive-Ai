import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import WrenchButton from "@components/WrenchButton";
import { fetchVehicleById } from "@lib/vehicles";

export default function VehicleDetailsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchVehicleById(id as string);
        setVehicle(data);
      } catch (err) {
        console.error("Error loading vehicle:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const openLogs = () => {
    router.push(`/(tabs)/(profile)/vehicles/${id}/logs`);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
        <ActivityIndicator size="large" color="#345bff" />
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: "#050509",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 18 }}>
          Vehicle not found.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* HEADER */}
        <View style={{ marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/(profile)/vehicles")}
            style={{ marginBottom: 12 }}
          >
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
          {vehicle.trim && (
            <Text style={styles.subtitle}>{vehicle.trim}</Text>
          )}
          {vehicle.color && (
            <Text style={styles.subtitle}>🎨 {vehicle.color}</Text>
          )}
        </View>

        {/* DETAILS */}
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>🛣 Mileage</Text>
            <Text style={styles.value}>
              {vehicle.mileage
                ? Number(vehicle.mileage).toLocaleString() + " miles"
                : "N/A"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>🔑 VIN</Text>
            <Text style={styles.value}>{vehicle.vin || "N/A"}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>📝 Notes</Text>
            <Text style={styles.value}>
              {vehicle.notes || "No notes added."}
            </Text>
          </View>
        </View>

        {/* LOGS BUTTON */}
        <TouchableOpacity onPress={openLogs} style={styles.logsButton}>
          <Text style={styles.logsButtonText}>📋 View Maintenance Logs</Text>
        </TouchableOpacity>

        <WrenchButton onPress={openLogs} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 26,
    fontWeight: "bold",
    color: "white",
  },
  subtitle: {
    fontSize: 15,
    color: "#9ca3af",
    marginTop: 4,
  },
  card: {
    backgroundColor: "#11131a",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252838",
    padding: 16,
    marginBottom: 20,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
  },
  divider: { height: 1, backgroundColor: "#252838" },
  label: { fontSize: 15, fontWeight: "600", color: "#9ca3af", flex: 1 },
  value: { fontSize: 15, color: "white", flex: 2, textAlign: "right" },
  logsButton: {
    backgroundColor: "#11131a",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#252838",
    alignItems: "center",
    marginBottom: 80,
  },
  logsButtonText: {
    color: "#f5f5f5",
    fontSize: 17,
    fontWeight: "700",
  },
});