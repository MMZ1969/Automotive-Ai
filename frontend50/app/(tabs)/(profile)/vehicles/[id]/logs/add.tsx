import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { createLog } from "@lib/logs";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
let ExpoSpeechRecognitionModule: any = null;
try {
  ExpoSpeechRecognitionModule = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
} catch (e) {
  console.log("Speech recognition not available in this environment");
}

export default function AddLogScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cost, setCost] = useState("");
  const [mileage, setMileage] = useState("");
  const [performedAt, setPerformedAt] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);

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

  const handleVoiceEntry = async () => {
  if (!ExpoSpeechRecognitionModule) {
    Alert.alert("Not Available", "Voice entry requires a device build. Coming soon!");
    return;
  }
  try {
    const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!result.granted) {
      Alert.alert("Permission needed", "Please allow microphone access for voice entry.");
      return;
    }

    setListening(true);

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: false,
    });

    ExpoSpeechRecognitionModule.addListener("result", async (event: any) => {
      const transcript = event.results?.[0]?.transcript;
      if (!transcript) return;
      setListening(false);
      ExpoSpeechRecognitionModule.stop();

      try {
        const res = await api.post("/api/voice-log", { transcript });
        const parsed = res.data;
        if (parsed.title) setTitle(parsed.title);
        if (parsed.date) setPerformedAt(parsed.date);
        if (parsed.cost) setCost(parsed.cost);
        if (parsed.mileage) setMileage(parsed.mileage);
        if (parsed.description) setDescription(parsed.description);
        Alert.alert("✅ Voice Captured!", "Review the extracted info and save.");
      } catch (err) {
        Alert.alert("Error", "Could not parse voice entry. Try again.");
      }
    });

    ExpoSpeechRecognitionModule.addListener("error", (event: any) => {
      console.error("SPEECH ERROR:", event);
      setListening(false);
      Alert.alert("Error", "Voice recognition failed. Try again.");
    });

  } catch (err) {
    console.error("VOICE ERROR:", err);
    setListening(false);
    Alert.alert("Error", "Could not start voice recognition.");
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
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.push(`/(tabs)/(profile)/vehicles/${id}/logs`)} style={{ marginRight: 12 }}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 22, fontWeight: "bold", color: colors.text }}>Add Log Entry</Text>
        </View>

        {/* ACTION BUTTONS ROW */}
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 24 }}>
          {/* SCAN RECEIPT */}
          <TouchableOpacity
            onPress={handleScanReceipt}
            disabled={scanning}
            style={{ flex: 1, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.blue, borderRadius: 14, padding: 16, alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {scanning ? (
              <>
                <ActivityIndicator color={colors.blue} size="small" />
                <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 13 }}>Scanning...</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 22 }}>📸</Text>
                <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 13 }}>Scan Receipt</Text>
              </>
            )}
          </TouchableOpacity>

          {/* VOICE ENTRY */}
          <TouchableOpacity
            onPress={handleVoiceEntry}
            disabled={listening}
            style={{ flex: 1, backgroundColor: listening ? "#1a0a2e" : colors.input, borderWidth: 1, borderColor: listening ? "#a855f7" : "#a855f7", borderRadius: 14, padding: 16, alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            {listening ? (
              <>
                <ActivityIndicator color="#a855f7" size="small" />
                <Text style={{ color: "#a855f7", fontWeight: "700", fontSize: 13 }}>Listening...</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 22 }}>🎤</Text>
                <Text style={{ color: "#a855f7", fontWeight: "700", fontSize: 13 }}>Voice Entry</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* RECEIPT PREVIEW */}
        {receiptImage && (
          <Image source={{ uri: receiptImage }} style={{ width: "100%", height: 150, borderRadius: 12, marginBottom: 20, resizeMode: "cover" }} />
        )}

        <Text style={labelStyle}>Title *</Text>
        <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="Oil Change, Brake Job, New Tires..." placeholderTextColor={colors.textMuted} />

        <Text style={labelStyle}>Date</Text>
        <TextInput style={inputStyle} value={performedAt} onChangeText={setPerformedAt} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />

        <Text style={labelStyle}>Cost ($)</Text>
        <TextInput style={inputStyle} value={cost} onChangeText={setCost} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

        <Text style={labelStyle}>Mileage at Service</Text>
        <TextInput style={inputStyle} value={mileage} onChangeText={setMileage} placeholder="50000" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

        <Text style={labelStyle}>Description</Text>
        <TextInput style={[inputStyle, { height: 120 }]} value={description} onChangeText={setDescription} placeholder="Details about the service..." placeholderTextColor={colors.textMuted} multiline />

        <TouchableOpacity style={{ backgroundColor: colors.blue, padding: 16, borderRadius: 14, alignItems: "center", marginTop: 24, marginBottom: 40 }} onPress={handleSave}>
          <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>💾 Save Log</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}