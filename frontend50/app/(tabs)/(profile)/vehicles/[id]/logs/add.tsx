import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import api from "@lib/api";
import { createLog } from "@lib/logs";

export default function AddLogScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [mileage, setMileage] = useState("");
  const [performedAt, setPerformedAt] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);

  const handleScanReceipt = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow camera access to scan receipts.");
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) return;

      setReceiptImage(result.assets[0].uri);
      setScanning(true);

      // Send to backend for AI extraction
        const base64 = result.assets[0].base64;
        const res = await api.post("/api/scan-receipt", {
          imageBase64: base64,
          mediaType: "image/jpeg",
        });
        const parsed = res.data;

      if (parsed.title) setTitle(parsed.title);
      if (parsed.date) setPerformedAt(parsed.date);
      if (parsed.cost) setCost(parsed.cost);
      if (parsed.mileage) setMileage(parsed.mileage);
      if (parsed.description) setDescription(parsed.description);

      Alert.alert("✅ Receipt Scanned!", "Review the extracted info and save.");
    } catch (err) {
      console.error("SCAN ERROR:", err);
      Alert.alert("Scan failed", "Could not read receipt. Please fill in manually.");
    } finally {
      setScanning(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert("Missing Title", "Please enter a log title.");
      return;
    }

    setLoading(true);
    try {
      await createLog(id as string, {
        title,
        description,
        cost: cost ? parseFloat(cost) : 0,
        mileage: mileage ? parseInt(mileage) : undefined,
        performedAt: performedAt ? new Date(performedAt).toISOString() : undefined,
      });
      router.push(`/(tabs)/(profile)/vehicles/${id}/logs`);
    } catch (err) {
      console.error("Error creating log:", err);
      Alert.alert("Error", "Failed to save log.");
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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/(profile)/vehicles/${id}/logs`)}
            style={{ marginRight: 12 }}
          >
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Log Entry</Text>
        </View>

        {/* SCAN RECEIPT BUTTON */}
        <TouchableOpacity
          onPress={handleScanReceipt}
          disabled={scanning}
          style={{
            backgroundColor: "#11131a",
            borderWidth: 1,
            borderColor: "#345bff",
            borderRadius: 14,
            padding: 16,
            alignItems: "center",
            marginBottom: 24,
            flexDirection: "row",
            justifyContent: "center",
            gap: 10,
          }}
        >
          {scanning ? (
            <>
              <ActivityIndicator color="#345bff" size="small" />
              <Text style={{ color: "#345bff", fontWeight: "700", fontSize: 16 }}>
                Scanning Receipt...
              </Text>
            </>
          ) : (
            <>
              <Text style={{ fontSize: 22 }}>📸</Text>
              <Text style={{ color: "#345bff", fontWeight: "700", fontSize: 16 }}>
                Scan Receipt with AI
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* RECEIPT PREVIEW */}
        {receiptImage && (
          <Image
            source={{ uri: receiptImage }}
            style={{ width: "100%", height: 150, borderRadius: 12, marginBottom: 20, resizeMode: "cover" }}
          />
        )}

        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Oil Change, Brake Job, New Tires..."
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
          <Text style={styles.saveButtonText}>💾 Save Log</Text>
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