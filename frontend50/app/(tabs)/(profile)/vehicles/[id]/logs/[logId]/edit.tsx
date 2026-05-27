import { useTheme } from "@context/ThemeContext";
import { fetchLogById, updateLog } from "@lib/logs";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function EditLogScreen() {
  const { id, logId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [mileage, setMileage] = useState("");
  const [performedAt, setPerformedAt] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!logId || !id) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchLogById(id as string, logId as string);
        if (data) {
          setTitle(data.title || "");
          setDescription(data.description || "");
          setCost(data.cost ? String(data.cost) : "");
          setMileage(data.mileage ? String(data.mileage) : "");
          setPerformedAt(data.performedAt ? new Date(data.performedAt).toISOString().split("T")[0] : "");
        }
      } catch (err) {
        console.error("Error loading log:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [logId, id]);

  const goBack = () => router.push(`/(tabs)/(profile)/vehicles/${id}/logs/${logId}`);

  const handleSave = async () => {
    if (!title.trim()) { Alert.alert("Missing Title", "Please enter a log title."); return; }
    setLoading(true);
    try {
      await updateLog(id as string, logId as string, {
        title,
        description,
        cost: cost ? parseFloat(cost) : 0,
        mileage: mileage ? parseInt(mileage) : undefined,
        performedAt: performedAt ? new Date(performedAt).toISOString() : undefined,
      });
      goBack();
    } catch (err) {
      console.error("Error updating log:", err);
      Alert.alert("Error", "Failed to update log.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={colors.blue} />
      </SafeAreaView>
    );
  }

  const inputStyle = { backgroundColor: colors.input, color: colors.text, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, fontSize: 15 };
  const labelStyle = { fontSize: 15, fontWeight: "600" as const, color: colors.textSecondary, marginTop: 16, marginBottom: 6 };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24, marginTop: 10 }}>
          <TouchableOpacity onPress={goBack} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text }}>Edit Log</Text>
        </View>

        <Text style={labelStyle}>Title *</Text>
        <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="Oil Change, Brake Job..." placeholderTextColor={colors.textMuted} />

        <Text style={labelStyle}>Date</Text>
        <TextInput style={inputStyle} value={performedAt} onChangeText={setPerformedAt} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

        <Text style={labelStyle}>Cost ($)</Text>
        <TextInput style={inputStyle} value={cost} onChangeText={setCost} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

        <Text style={labelStyle}>Mileage at Service</Text>
        <TextInput style={inputStyle} value={mileage} onChangeText={setMileage} placeholder="50000" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

        <Text style={labelStyle}>Description</Text>
        <TextInput style={[inputStyle, { height: 120 }]} value={description} onChangeText={setDescription} placeholder="Details about the service..." placeholderTextColor={colors.textMuted} multiline />

        <TouchableOpacity style={{ backgroundColor: colors.blue, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 24, marginBottom: 40 }} onPress={handleSave}>
          <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>💾 Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}