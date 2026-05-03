import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchLogById, updateLog } from "@lib/logs";

export default function EditLogScreen() {
  const { id, logId } = useLocalSearchParams();
  const router = useRouter();

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
          setPerformedAt(
            data.performedAt
              ? new Date(data.performedAt).toISOString().split("T")[0]
              : ""
          );
        }
      } catch (err) {
        console.error("Error loading log:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [logId, id]);

  const goBack = () => {
    router.push(`/(tabs)/(profile)/vehicles/${id}/logs/${logId}`);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter a log title.");
      return;
    }
    setLoading(true);
    try {
      await updateLog(id as string, logId as string, {
        title,
        description,
        cost: cost ? parseFloat(cost) : 0,
        mileage: mileage ? parseInt(mileage) : undefined,
        performedAt: performedAt
          ? new Date(performedAt).toISOString()
          : undefined,
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
        <ActivityIndicator size="large" color="#345bff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#050509" }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* HEADER */}
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 24,
          marginTop: 10,
        }}>
          <TouchableOpacity onPress={goBack} style={{ marginRight: 12 }}>
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Edit Log</Text>
        </View>

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Oil Change, Brake Job..."
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Date</Text>
        <TextInput
          style={styles.input}
          value={performedAt}
          onChangeText={setPerformedAt}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#6b7280"
        />

        <Text style={styles.label}>Cost ($)</Text>
        <TextInput
          style={styles.input}
          value={cost}
          onChangeText={setCost}
          placeholder="0.00"
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Mileage at Service</Text>
        <TextInput
          style={styles.input}
          value={mileage}
          onChangeText={setMileage}
          placeholder="50000"
          placeholderTextColor="#6b7280"
          keyboardType="numeric"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, { height: 120 }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Details about the service..."
          placeholderTextColor="#6b7280"
          multiline
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>💾 Save Changes</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: "bold", color: "white" },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9ca3af",
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#11131a",
    color: "white",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#252838",
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: "#345bff",
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 24,
    marginBottom: 40,
  },
  saveButtonText: { color: "white", fontSize: 17, fontWeight: "700" },
});
