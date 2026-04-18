import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import VehicleCard from "@components/VehicleCard";
import WrenchButton from "@components/WrenchButton";
import { useVehicle } from "@context/VehicleContext";
import { fetchVehicles } from "@lib/vehicles";

export default function VehiclesScreen() {
  const router = useRouter();
  const { vehicles, setVehicles, loading, setLoading } = useVehicle();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchVehicles();
        setVehicles(data || []);
      } catch (err) {
        console.error("Error loading vehicles:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleOpenVehicle = (id: string) => {
    router.push(`/(tabs)/(profile)/vehicles/${id}`);
  };

  const handleAddVehicle = () => {
    router.push(`/(tabs)/(profile)/vehicles/add`);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
        <ActivityIndicator size="large" color="#345bff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
      <View style={{ flex: 1, padding: 16 }}>
        {/* HEADER */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 16,
        }}>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/(profile)")}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "bold" }}>
            My Vehicles
          </Text>
        </View>

        {vehicles.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: "#9ca3af", fontSize: 16, textAlign: "center" }}>
              No vehicles yet.{"\n"}Tap the wrench to add your first vehicle!
            </Text>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <VehicleCard
                vehicle={item}
                onPress={() => handleOpenVehicle(item.id)}
              />
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        <WrenchButton onPress={handleAddVehicle} />
      </View>
    </SafeAreaView>
  );
}