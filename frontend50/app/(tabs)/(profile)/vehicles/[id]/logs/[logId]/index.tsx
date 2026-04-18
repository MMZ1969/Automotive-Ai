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
import { fetchLogById } from "@lib/logs";

export default function LogDetailsScreen() {
  const { id, logId } = useLocalSearchParams();
  const router = useRouter();

  const [log, setLog] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!logId || !id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchLogById(id as string, logId as string);
        setLog(data);
      } catch (err) {
        console.error("Error loading log:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [logId, id]);

  const goBack = () => {
    router.push(`/(tabs)/(profile)/vehicles/${id}/logs`);
  };

  const openEdit = () => {
    router.push(`/(tabs)/(profile)/vehicles/${id}/logs/${String(logId)}/edit`);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
        <ActivityIndicator size="large" color="#345bff" />
      </SafeAreaView>
    );
  }

  if (!log) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: "white", fontSize: 18 }}>Log not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity onPress={goBack} style={{ marginRight: 12 }}>
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{log.title || "Log Detail"}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>📅 Date</Text>
            <Text style={styles.value}>
              {log.performedAt
                ? new Date(log.performedAt).toLocaleDateString()
                : "N/A"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>💰 Cost</Text>
            <Text style={styles.value}>
              ${log.cost ? parseFloat(log.cost).toFixed(2) : "0.00"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>🛣 Mileage</Text>
            <Text style={styles.value}>
              {log.mileage ? Number(log.mileage).toLocaleString() + " miles" : "N/A"}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.row}>
            <Text style={styles.label}>📝 Description</Text>
            <Text style={styles.value}>
              {log.description || "No description added."}
            </Text>
          </View>
        </View>

        <WrenchButton onPress={openEdit} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "bold", color: "white" },
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
});