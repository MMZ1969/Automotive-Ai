import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import LogCard from "@components/LogCard";
import { useLog } from "@context/LogContext";
import { fetchLogsByVehicle } from "@lib/logs";

export default function VehicleLogsScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { logs, setLogs, loading, setLoading } = useLog();

  useEffect(() => {
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
  }, [id]);

  const handleOpenLog = (logId: string) => {
    router.push(`/tabs/(profile)/vehicles/${id}/logs/${logId}`);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, padding: 16 }}>
      {logs.length === 0 ? (
        <Text style={{ textAlign: "center", marginTop: 20, color: "#9ca3af" }}>
          No logs found. Go to a vehicle to add logs!
        </Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <LogCard log={item} onPress={() => handleOpenLog(item.id)} />
          )}
        />
      )}
    </View>
  );
}