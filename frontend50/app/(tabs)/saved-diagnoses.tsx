import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";

const severityColor = (severity: string, colors: any) => {
  switch (severity) {
    case "Low": return "#10b981"; case "Medium": return "#f59e0b";
    case "High": return "#f97316"; case "Critical": return "#ef4444";
    default: return colors.textMuted;
  }
};

export default function SavedDiagnosesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get("/api/diagnose/saved");
        setSaved(res.data || []);
      } catch (err) {
        console.error("FETCH SAVED DIAGNOSES ERROR:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []));

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>💾 Saved Diagnoses</Text>
      </View>

      <FlatList
        data={saved}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 20 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 40 }}>🔧</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: "center" }}>
              No saved diagnoses yet.{"\n"}Run a diagnosis and tap Save to keep it here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/saved-diagnosis/${item.id}`)}
            style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 }}
          >
            {item.vehicleLabel && (
              <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>🚗 {item.vehicleLabel}</Text>
            )}
            <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700", marginBottom: 8 }} numberOfLines={2}>
              {item.summary}
            </Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ backgroundColor: severityColor(item.severity, colors) + "33", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: severityColor(item.severity, colors) }}>
                <Text style={{ color: severityColor(item.severity, colors), fontSize: 11, fontWeight: "700" }}>{item.severity}</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
