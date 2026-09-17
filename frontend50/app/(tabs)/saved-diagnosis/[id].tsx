import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Linking, ScrollView, Text, TouchableOpacity, View } from "react-native";

const severityColor = (severity: string) => {
  switch (severity) {
    case "Low": return "#10b981"; case "Medium": return "#f59e0b";
    case "High": return "#f97316"; case "Critical": return "#ef4444";
    default: return "#6b7280";
  }
};

export default function SavedDiagnosisDetail() {
  const { id } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const [saved, setSaved] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/api/diagnose/saved/${id}`);
        setSaved(res.data);
      } catch (err) {
        console.error("FETCH SAVED DIAGNOSIS ERROR:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleDelete = () => {
    Alert.alert("Delete Saved Diagnosis", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await api.delete(`/api/diagnose/saved/${id}`);
          router.back();
        } catch {
          Alert.alert("Error", "Could not delete. Try again.");
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  if (!saved) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Diagnosis not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 40, marginBottom: 20 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={{ color: "#ef4444", fontSize: 14, fontWeight: "700" }}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>

      {saved.vehicleLabel && (
        <Text style={{ color: colors.blue, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>🚗 {saved.vehicleLabel}</Text>
      )}
      <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 16 }}>
        Saved {new Date(saved.createdAt).toLocaleDateString()}
      </Text>

      {/* Summary Card */}
      <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginBottom: 8 }}>{saved.summary}</Text>
        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <View style={{ backgroundColor: severityColor(saved.severity) + "33", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: severityColor(saved.severity) }}>
            <Text style={{ color: severityColor(saved.severity), fontWeight: "700" }}>{saved.severity} Severity</Text>
          </View>
          {saved.estimatedCost && (
            <View style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>💰 {saved.estimatedCost}</Text>
            </View>
          )}
          {saved.diyDifficulty && (
            <View style={{ backgroundColor: colors.card, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>🔧 {saved.diyDifficulty}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Immediate Action */}
      {saved.immediateAction && (
        <View style={{ backgroundColor: "#1a0a0a", borderRadius: 16, borderWidth: 1, borderColor: "#ef444433", padding: 16, marginBottom: 14 }}>
          <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 14, marginBottom: 6 }}>⚠️ Immediate Action</Text>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{saved.immediateAction}</Text>
        </View>
      )}

      {/* Likely Causes */}
      {saved.causes?.length > 0 && (
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>🔍 Likely Causes</Text>
          {saved.causes.map((cause: string, i: number) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
              <Text style={{ color: colors.blue, fontWeight: "700" }}>{i + 1}.</Text>
              <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{cause}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Diagnosis Steps */}
      {saved.diagnosisSteps?.length > 0 && (
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>📋 Diagnosis Steps</Text>
          {saved.diagnosisSteps.map((step: any, i: number) => {
            const stepText = typeof step === "string" ? step : step?.text;
            const stepTip = typeof step === "string" ? null : step?.tip;
            return (
              <View key={i} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                  <View style={{ backgroundColor: colors.blue, width: 22, height: 22, borderRadius: 11, justifyContent: "center", alignItems: "center" }}>
                    <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 14, flex: 1, lineHeight: 20 }}>{stepText}</Text>
                </View>
                {stepTip && (
                  <View style={{ marginLeft: 32, marginTop: 6, backgroundColor: colors.background, borderRadius: 8, borderWidth: 1, borderColor: colors.blue + "33", padding: 8 }}>
                    <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "600" }}>💡 {stepTip}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Pro Tip */}
      {saved.proTip && (
        <View style={{ backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.blue + "33", padding: 16, marginBottom: 14 }}>
          <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 14, marginBottom: 6 }}>💡 Pro Tip</Text>
          <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{saved.proTip}</Text>
        </View>
      )}

      {/* eBay Parts */}
      {saved.ebayParts?.length > 0 && (
        <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: "#e5a00d44", padding: 16, marginBottom: 40 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, marginBottom: 12 }}>🛒 Parts You May Need</Text>
          {saved.ebayParts.map((part: any, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => Linking.openURL(part.ebayUrl)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.background, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 8 }}
            >
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 14, textTransform: "capitalize" }}>{part.partName}</Text>
              <Text style={{ color: "#e5a00d", fontWeight: "800", fontSize: 15 }}>${part.priceMin} – ${part.priceMax}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </ScrollView>
  );
}
