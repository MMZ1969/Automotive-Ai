import VehicleCard from "@components/VehicleCard";
import WrenchButton from "@components/WrenchButton";
import { useTheme } from "@context/ThemeContext";
import { useVehicle } from "@context/VehicleContext";
import { fetchVehicles } from "@lib/vehicles";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function VehiclesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { vehicles, setVehicles, loading, setLoading } = useVehicle();

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try { const data = await fetchVehicles(); setVehicles(data || []); }
      catch (err) { console.error("Error loading vehicles:", err); }
      finally { setLoading(false); }
    };
    load();
  }, []));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1, padding: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/(profile)")} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "bold" }}>My Vehicles</Text>
        </View>

        {vehicles.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: "center" }}>
              No vehicles yet.{"\n"}Tap the wrench to add your first vehicle!
            </Text>
          </View>
        ) : (
          <FlatList
            data={vehicles}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => <VehicleCard vehicle={item} onPress={() => router.push(`/(tabs)/(profile)/vehicles/${item.id}`)} />}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        <WrenchButton onPress={() => router.push(`/(tabs)/(profile)/vehicles/add`)} />
      </View>
    </SafeAreaView>
  );
}
