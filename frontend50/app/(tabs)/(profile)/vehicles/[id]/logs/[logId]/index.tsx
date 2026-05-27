import WrenchButton from "@components/WrenchButton";
import { useTheme } from "@context/ThemeContext";
import { deleteLog, fetchLogById } from "@lib/logs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LogDetailsScreen() {
  const { id, logId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
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

  const goBack = () => router.push(`/(tabs)/(profile)/vehicles/${id}/logs`);
  const openEdit = () => router.push(`/(tabs)/(profile)/vehicles/${id}/logs/${String(logId)}/edit`);

  const handleDelete = () => {
    Alert.alert("Delete Log", "Are you sure you want to delete this log? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteLog(id as string, logId as string);
            router.push(`/(tabs)/(profile)/vehicles/${id}/logs`);
          } catch (err) {
            Alert.alert("Error", "Could not delete log. Try again.");
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </SafeAreaView>
    );
  }

  if (!log) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 18 }}>Log not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24, marginTop: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <TouchableOpacity onPress={goBack} style={{ marginRight: 12 }}>
              <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text }}>{log.title || "Log Detail"}</Text>
          </View>
          <TouchableOpacity onPress={handleDelete}>
            <Text style={{ color: "#ef4444", fontSize: 14, fontWeight: "700" }}>Delete</Text>
          </TouchableOpacity>
        </View>

        <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary, flex: 1 }}>📅 Date</Text>
            <Text style={{ fontSize: 15, color: colors.text, flex: 2, textAlign: "right" }}>{log.performedAt ? new Date(log.performedAt).toLocaleDateString() : "N/A"}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary, flex: 1 }}>💰 Cost</Text>
            <Text style={{ fontSize: 15, color: colors.text, flex: 2, textAlign: "right" }}>${log.cost ? parseFloat(log.cost).toFixed(2) : "0.00"}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary, flex: 1 }}>🛣 Mileage</Text>
            <Text style={{ fontSize: 15, color: colors.text, flex: 2, textAlign: "right" }}>{log.mileage ? Number(log.mileage).toLocaleString() + " miles" : "N/A"}</Text>
          </View>
          <View style={{ height: 1, backgroundColor: colors.border }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: colors.textSecondary, flex: 1 }}>📝 Description</Text>
            <Text style={{ fontSize: 15, color: colors.text, flex: 2, textAlign: "right" }}>{log.description || "No description added."}</Text>
          </View>
        </View>

        <WrenchButton onPress={openEdit} />
      </ScrollView>
    </SafeAreaView>
  );
}