import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { ensureFirebaseAuth } from "@lib/firebaseAuth";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useState } from "react";
import {
    ActivityIndicator, Alert, Image, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { storage } from "../../../firebaseConfig.js";

export default function VerifyMechanic() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();

  const [licenseNumber, setLicenseNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [proofPhotoUrl, setProofPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const inputStyle = {
    backgroundColor: colors.card, color: colors.text,
    padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, marginBottom: 14, fontSize: 15,
  };
  const labelStyle = { color: colors.text, fontSize: 13, fontWeight: "700" as const, marginBottom: 6 };

  const uploadProof = async (uri: string) => {
    try {
      setUploading(true); setUploadProgress(0);
      await ensureFirebaseAuth();
      const blob = await (await fetch(uri)).blob();
      const storageRef = ref(storage, `verification-proofs/${user?.id}/proof_${Date.now()}.jpg`);
      const task = uploadBytesResumable(storageRef, blob);
      task.on("state_changed",
        (s) => setUploadProgress(Math.round((s.bytesTransferred / s.totalBytes) * 100)),
        () => { Alert.alert("Upload failed", "Please try again."); setUploading(false); },
        async () => { setProofPhotoUrl(await getDownloadURL(task.snapshot.ref)); setUploading(false); },
      );
    } catch {
      Alert.alert("Upload failed", "Please try again.");
      setUploading(false);
    }
  };

  const pickProof = () => {
    Alert.alert("Proof Photo", "Choose a source", [
      {
        text: "Camera",
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") return Alert.alert("Permission needed", "Allow camera access to take a photo.");
          const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
          if (!result.canceled && result.assets?.[0]?.uri) uploadProof(result.assets[0].uri);
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") return Alert.alert("Permission needed", "Allow photo access to choose a picture.");
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
          if (!result.canceled && result.assets?.[0]?.uri) uploadProof(result.assets[0].uri);
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleSubmit = async () => {
    if (!shopName.trim()) {
      Alert.alert("Missing info", "Shop or business name is required.");
      return;
    }
    if (!licenseNumber.trim() && !proofPhotoUrl) {
      Alert.alert("Add proof", "Add your ASE / certification number or a proof photo (work ID, uniform, cert, or business card).");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/api/users/verification-request", {
        licenseNumber, shopName, shopLocation, experience, proofPhotoUrl,
      });
      Alert.alert("✅ Submitted!", "Your verification request has been sent. You'll get a notification once it's reviewed.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.error || "Could not submit request. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled" bottomOffset={24}>
        {/* HEADER */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 50, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>🏁 Get Verified</Text>
        </View>

        <Text style={{ color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
          Verified mechanics get a badge on their profile, a gold 🏁 pin on the Near Me map, and more trust from customers.
        </Text>

        <View style={{ backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 20 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: "700", marginBottom: 6 }}>No certificate? No problem.</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13, lineHeight: 19 }}>
            We just need to confirm you're a working mechanic. Any ONE of these works:{"\n"}
            • ASE or other certification number{"\n"}
            • Photo of your work ID, badge, or shop uniform{"\n"}
            • Photo of your business card or shop sign
          </Text>
        </View>

        <Text style={labelStyle}>ASE # or Certification (optional)</Text>
        <TextInput
          placeholder="e.g. ASE A1–A8 #12345"
          placeholderTextColor={colors.textMuted}
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          style={inputStyle}
        />

        <Text style={labelStyle}>Proof Photo {licenseNumber.trim() ? "(optional)" : "*"}</Text>
        <TouchableOpacity
          onPress={pickProof}
          disabled={uploading}
          style={{
            backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderStyle: "dashed",
            borderColor: proofPhotoUrl ? colors.green : colors.border, marginBottom: 14,
            height: proofPhotoUrl ? 200 : 90, justifyContent: "center", alignItems: "center", overflow: "hidden",
          }}
        >
          {uploading ? (
            <View style={{ alignItems: "center" }}>
              <ActivityIndicator color={colors.blue} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 6 }}>Uploading {uploadProgress}%</Text>
            </View>
          ) : proofPhotoUrl ? (
            <Image source={{ uri: proofPhotoUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          ) : (
            <Text style={{ color: colors.textSecondary, fontSize: 14 }}>📷 Add work ID, uniform, or cert photo</Text>
          )}
        </TouchableOpacity>
        {proofPhotoUrl && !uploading && (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: -8, marginBottom: 14 }}>
            Tap the photo to replace it. Only the AutoAI team can see this photo.
          </Text>
        )}

        <Text style={labelStyle}>Shop / Business Name *</Text>
        <TextInput
          placeholder="e.g. Mike's Auto Repair, Monro, or Mobile"
          placeholderTextColor={colors.textMuted}
          value={shopName}
          onChangeText={setShopName}
          style={inputStyle}
        />

        <Text style={labelStyle}>Shop Location</Text>
        <TextInput
          placeholder="e.g. Sandy Springs, GA"
          placeholderTextColor={colors.textMuted}
          value={shopLocation}
          onChangeText={setShopLocation}
          style={inputStyle}
        />

        <Text style={labelStyle}>Years of Experience</Text>
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
          disabled={submitting || uploading}
          style={{ backgroundColor: colors.blue, opacity: submitting || uploading ? 0.6 : 1, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 8, marginBottom: 40 }}
        >
          <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
            {submitting ? "Submitting..." : "Submit for Review"}
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}
