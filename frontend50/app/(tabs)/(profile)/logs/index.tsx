import { useTheme } from "@context/ThemeContext";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";

import LogCard from "@components/LogCard";
import { fetchAllLogs } from "@lib/logs";

export default function AllLogsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        setLoading(true);
        try {
          const data = await fetchAllLogs();
          setLogs(data || []);
        } catch (err) {
          console.error("Error loading logs:", err);
        } finally {
          setLoading(false);
        }
      };
      load();
    }, [])
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 20 }}>
      <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginTop: 40, marginBottom: 20 }}>
        📋 Maintenance Logs
      </Text>
      {logs.length === 0 ? (
        <Text style={{ textAlign: "center", marginTop: 20, color: colors.textSecondary }}>
          No maintenance logs yet. Go to a vehicle to add logs!
        </Text>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item: any) => item.id.toString()}
          renderItem={({ item }) => (
            <LogCard
              log={item}
              onPress={() => router.push(`/(tabs)/(profile)/vehicles/${item.vehicleId}/logs/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}