import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View,
} from "react-native";

const statusColor = (status: string) => {
  switch (status) {
    case "OPEN": return "#10b981";
    case "PENDING_CONFIRM": return "#f59e0b";
    case "IN_PROGRESS": return "#345bff";
    case "COMPLETED": return "#6b7280";
    default: return "#6b7280";
  }
};

export default function DIYerJobHistory() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchJobs = async () => {
    try {
      const res = await api.get("/api/jobs/mine");
      setJobs(res.data);
    } catch (err) {
      console.error("FETCH JOB HISTORY ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchJobs(); }, []));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>💼 Job History</Text>
      </View>

      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchJobs(); }} tintColor={colors.blue} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>💼</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>No jobs yet</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>
              Jobs you post will appear here
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: colors.card, borderRadius: 16, borderWidth: 1,
            borderColor: colors.border, padding: 16, marginBottom: 14,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700", flex: 1 }}>{item.title}</Text>
              <View style={{ backgroundColor: statusColor(item.status) + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: statusColor(item.status) }}>
                <Text style={{ color: statusColor(item.status), fontSize: 11, fontWeight: "700" }}>{item.status}</Text>
              </View>
            </View>

            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>🚗 {item.vehicle}</Text>
            {item.budget ? <Text style={{ color: colors.green, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>💰 ${item.budget}</Text> : <View style={{ marginBottom: 8 }} />}

            {item.mechanic && (
              <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Mechanic</Text>
                <Text style={{ color: colors.text, fontWeight: "700" }}>🔧 {item.mechanic.name}</Text>
                {item.mechanic.phone && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.mechanic.phone}</Text>}
              </View>
            )}

            <Text style={{ color: colors.textMuted, fontSize: 12 }}>
              Posted {new Date(item.createdAt).toLocaleDateString()}
            </Text>
          </View>
        )}
      />
    </View>
  );
}