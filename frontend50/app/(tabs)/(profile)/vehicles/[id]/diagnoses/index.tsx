import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const severityColor = (severity: string, colors: any) => {
  switch (severity) {
    case "Low": return "#10b981"; case "Medium": return "#f59e0b";
    case "High": return "#f97316"; case "Critical": return "#ef4444";
    default: return colors.textMuted;
  }
};

export default function VehicleDiagnosesScreen() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/api/diagnose/saved?vehicleId=${id}`);
        setSaved(res.data || []);
      } catch (err) {
        console.error("FETCH VEHICLE DIAGNOSES ERROR:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]));

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.blue} style={{ marginTop: 100 }} />
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
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "bold" }}>Saved Diagnoses</Text>
        </View>

        <FlatList
          data={saved}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", marginTop: 60 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center" }}>
                No saved diagnoses for this vehicle yet.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/saved-diagnosis/${item.id}`)}
              style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 }}
            >
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
    </SafeAreaView>
  );
}
