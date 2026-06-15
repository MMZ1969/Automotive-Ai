import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    Alert, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View,
} from "react-native";

export default function VerifyMechanic() {
  const { colors } = useTheme();
  const router = useRouter();

  const [licenseNumber, setLicenseNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const inputStyle = {
    backgroundColor: colors.card, color: colors.text,
    padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, marginBottom: 14, fontSize: 15,
  };

  const handleSubmit = async () => {
    if (!licenseNumber.trim() || !shopName.trim()) {
      Alert.alert("Missing fields", "License/Cert number and shop name are required.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/api/users/verification-request", {
        licenseNumber, shopName, shopLocation, experience,
      });
      Alert.alert("✅ Submitted!", "Your verification request has been sent. We'll review it shortly.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Could not submit request. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 50, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>🏁 Get Verified</Text>
        </View>

        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 24 }}>
          Verified mechanics get a badge on their profile, appear in Near Me searches, and build more trust with customers. Fill out the info below and our team will review your request.
        </Text>

        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>License / Certification Number *</Text>
        <TextInput
          placeholder="e.g. ASE Master Cert #12345"
          placeholderTextColor={colors.textMuted}
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          style={inputStyle}
        />

        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Shop Name *</Text>
        <TextInput
          placeholder="e.g. Mike's Auto Repair"
          placeholderTextColor={colors.textMuted}
          value={shopName}
          onChangeText={setShopName}
          style={inputStyle}
        />

        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Shop Location</Text>
        <TextInput
          placeholder="e.g. Sandy Springs, GA"
          placeholderTextColor={colors.textMuted}
          value={shopLocation}
          onChangeText={setShopLocation}
          style={inputStyle}
        />

        <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>Years of Experience</Text>
        <TextInput
          placeholder="e.g. 8"
          placeholderTextColor={colors.textMuted}
          value={experience}
          onChangeText={setExperience}
          keyboardType="numeric"
          style={inputStyle}
        />

        <TouchableOpacity
          onPress={handleSubmit}
          disabled={submitting}
          style={{ backgroundColor: colors.blue, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8, marginBottom: 40 }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
            {submitting ? "Submitting..." : "Submit for Review"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}