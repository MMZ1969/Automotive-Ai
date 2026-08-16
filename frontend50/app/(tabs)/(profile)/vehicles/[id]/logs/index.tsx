import { useTheme } from "@context/ThemeContext";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import LogCard from "@components/LogCard";
import WrenchButton from "@components/WrenchButton";
import { useLog } from "@context/LogContext";
import { fetchLogsByVehicle } from "@lib/logs";

export default function VehicleLogsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const { logs, setLogs, loading, setLoading } = useLog();

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      const load = async () => {
        setLoading(true);
        try {
          const data = await fetchLogsByVehicle(id as string);
          setLogs(data || []);
        } catch (err) {
          console.error("Error loading logs:", err);
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [id])
  );

  const handleOpenLog = (logId: string) => {
    router.push(`/(tabs)/(profile)/vehicles/${id}/logs/${logId}`);
  };

  const handleAddLog = () => {
    router.push(`/(tabs)/(profile)/vehicles/${id}/logs/add`);
  };

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
          <TouchableOpacity onPress={() => router.push(`/(tabs)/(profile)/vehicles/${id}`)} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "bold" }}>
            Maintenance Logs
          </Text>
        </View>

        {logs.length === 0 ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary, fontSize: 16, textAlign: "center" }}>
              No logs yet.{"\n"}Tap the wrench to add your first log!
            </Text>
          </View>
        ) : (
          <FlatList
            data={logs}
            keyExtractor={(item) => item.id.toString()}
            renderItem={({ item }) => (
              <LogCard log={item} onPress={() => handleOpenLog(item.id)} />
            )}
            contentContainerStyle={{ paddingBottom: 100 }}
          />
        )}

        <WrenchButton onPress={handleAddLog} />
      </View>
    </SafeAreaView>
  );
}
