import LogCard from "@components/LogCard";
import VehicleCard from "@components/VehicleCard";
import WrenchButton from "@components/WrenchButton";
import { useTheme } from "@context/ThemeContext";
import { useVehicle } from "@context/VehicleContext";
import { fetchAllLogs } from "@lib/logs";
import { fetchVehicles } from "@lib/vehicles";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function GarageScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { vehicles, setVehicles, loading: vehiclesLoading, setLoading: setVehiclesLoading } = useVehicle();
  const [activeTab, setActiveTab] = useState<"vehicles" | "logs">("vehicles");
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const loadVehicles = async () => {
        setVehiclesLoading(true);
        try {
          const data = await fetchVehicles();
          setVehicles(data || []);
        } catch (err) {
          console.error("Error loading vehicles:", err);
        } finally {
          setVehiclesLoading(false);
        }
      };

      const loadLogs = async () => {
        setLogsLoading(true);
        try {
          const data = await fetchAllLogs();
          console.log("FIRST LOG:", JSON.stringify(data?.[0]));
          setLogs(data || []);
        } catch (err) {
          console.error("Error loading logs:", err);
        } finally {
          setLogsLoading(false);
        }
      };

      loadVehicles();
      loadLogs();
    }, [])
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 0 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>🚗 My Garage</Text>
        </View>

        {/* TABS */}
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border, marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => setActiveTab("vehicles")}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: activeTab === "vehicles" ? colors.blue : "transparent" }}
          >
            <Text style={{ color: activeTab === "vehicles" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>🚗 Vehicles</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("logs")}
            style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: activeTab === "logs" ? colors.blue : "transparent" }}
          >
            <Text style={{ color: activeTab === "logs" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>📋 Service Logs</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VEHICLES TAB */}
      {activeTab === "vehicles" && (
        <>
          {vehiclesLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.blue} />
            </View>
          ) : vehicles.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>🚗</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>No vehicles yet</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", marginTop: 8 }}>
                Tap the wrench to add your first vehicle!
              </Text>
            </View>
          ) : (
            <FlatList
              data={vehicles}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
              renderItem={({ item }) => (
                <VehicleCard
                  vehicle={item}
                  onPress={() => router.push(`/(tabs)/(profile)/vehicles/${item.id}`)}
                />
              )}
            />
          )}
          <WrenchButton onPress={() => router.push("/(tabs)/(profile)/vehicles/add")} />
        </>
      )}

      {/* SERVICE LOGS TAB */}
      {activeTab === "logs" && (
        <>
          {logsLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={colors.blue} />
            </View>
          ) : logs.length === 0 ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40 }}>
              <Text style={{ fontSize: 48, marginBottom: 16 }}>📋</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", textAlign: "center" }}>No logs yet</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 14, textAlign: "center", marginTop: 8 }}>
                Go to a vehicle to add maintenance logs!
              </Text>
            </View>
          ) : (
            <FlatList
              data={logs}
              keyExtractor={(item: any) => item.id.toString()}
              contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
              renderItem={({ item }) => (
                <LogCard
                  log={item}
                  onPress={() => router.push(`/(tabs)/(profile)/vehicles/${item.vehicleId}/logs/${item.id}`)}
                />
              )}
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}
