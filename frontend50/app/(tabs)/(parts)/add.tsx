import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useState } from "react";
import {
  ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { storage } from "../../../firebaseConfig.js";

const CATEGORIES = ["Engine", "Suspension", "Brakes", "Body", "Interior", "Tires", "Exhaust", "Electrical", "Other"];
const CONDITIONS = ["New", "Like New", "Good", "Fair"];
const PRICE_TYPES = ["FIXED", "OBO", "TRADE", "FREE"];
const PRICE_TYPE_LABELS: Record<string, string> = { FIXED: "Fixed Price", OBO: "Or Best Offer", TRADE: "Trade Only", FREE: "Free" };

export default function AddPartScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Engine");
  const [condition, setCondition] = useState("Good");
  const [priceType, setPriceType] = useState("FIXED");
  const [price, setPrice] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [contactPreference, setContactPreference] = useState("EMAIL");

  const handlePickPhoto = async () => {
    Alert.alert("Add Photo", "Choose an option", [
      { text: "Take Photo", onPress: async () => {
        try {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Please allow camera access."); return; }
          const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.7, base64: true });
          if (result.canceled) return;
          const asset = result.assets[0];
          setImageUri(asset.uri);
          await Promise.all([uploadToFirebase(asset.uri), analyzeWithAI(asset.base64!, asset.mimeType || "image/jpeg")]);
        } catch { Alert.alert("Error", "Could not open camera."); }
      }},
      { text: "Choose from Library", onPress: async () => {
        try {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== "granted") { Alert.alert("Permission needed", "Please allow access to your photo library."); return; }
          const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7, base64: true });
          if (result.canceled) return;
          const asset = result.assets[0];
          setImageUri(asset.uri);
          await Promise.all([uploadToFirebase(asset.uri), analyzeWithAI(asset.base64!, asset.mimeType || "image/jpeg")]);
        } catch { Alert.alert("Error", "Could not open photo library."); }
      }},
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const analyzeWithAI = async (base64: string, mediaType: string) => {
    try {
      setAnalyzing(true);
      const res = await api.post("/api/analyze-part", { imageBase64: base64, mediaType });
      const { title, category, condition, description } = res.data;
      if (title) setTitle(title);
      if (description) setDescription(description);
      if (category && CATEGORIES.includes(category)) setCategory(category);
      if (condition && CONDITIONS.includes(condition)) setCondition(condition);
    } catch { }
    finally { setAnalyzing(false); }
  };

  const uploadToFirebase = async (uri: string) => {
    try {
      setUploading(true); setUploadProgress(0);
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `part-photos/${user?.id}/part_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      uploadTask.on("state_changed",
        (snapshot) => setUploadProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)),
        (error) => { Alert.alert("Upload failed", "Please try again."); setUploading(false); },
        async () => { const downloadURL = await getDownloadURL(uploadTask.snapshot.ref); setImageUrl(downloadURL); setUploading(false); }
      );
    } catch { setUploading(false); }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { Alert.alert("Missing Info", "Please add a title for your listing."); return; }
    if (uploading || analyzing) { Alert.alert("Please wait", "Still processing your photo..."); return; }
    try {
      setSubmitting(true);
      await api.post("/api/parts", { title, description, category, condition, priceType, price: priceType !== "TRADE" && priceType !== "FREE" && price ? parseFloat(price) : null, imageUrl, contactPreference });
      Alert.alert("🔩 Listed!", "Your part is now listed.", [
        { text: "View Listings", onPress: () => router.push("/(tabs)/(parts)") },
        { text: "List Another", onPress: () => router.replace("/(tabs)/(parts)/add") },
      ]);
    } catch { Alert.alert("Error", "Could not create listing. Try again."); }
    finally { setSubmitting(false); }
  };

  const labelStyle = { fontSize: 15, fontWeight: "600" as const, color: colors.textSecondary, marginBottom: 8 };
  const inputStyle = { backgroundColor: colors.card, color: colors.text, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, fontSize: 15, marginBottom: 16 };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 40, marginBottom: 24 }}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/(parts)")}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>List a Part</Text>
          <TouchableOpacity onPress={handleSubmit} disabled={submitting || uploading || analyzing}
            style={{ backgroundColor: submitting || uploading || analyzing ? colors.border : colors.blue, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
            {submitting ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "700" }}>Post</Text>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={handlePickPhoto} disabled={uploading || analyzing}
          style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, borderStyle: "dashed", height: 180, justifyContent: "center", alignItems: "center", marginBottom: 12, overflow: "hidden" }}>
          {imageUri ? (
            <>
              <Image source={{ uri: imageUri }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
              {(uploading || analyzing) && (
                <View style={{ position: "absolute", backgroundColor: "rgba(0,0,0,0.7)", width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }}>
                  <ActivityIndicator color={colors.blue} size="large" />
                  <Text style={{ color: "white", marginTop: 12, fontWeight: "700" }}>{analyzing ? "🤖 AI analyzing part..." : `Uploading ${uploadProgress}%`}</Text>
                </View>
              )}
            </>
          ) : (
            <>
              <Text style={{ fontSize: 36 }}>📷</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, fontWeight: "600" }}>Add Photo</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>AI will autofill your listing!</Text>
            </>
          )}
        </TouchableOpacity>

        {!imageUri && (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 20, backgroundColor: colors.background, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.blue + "33" }}>
            <Text style={{ fontSize: 16 }}>🤖</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Take a photo and AI will fill in title, category, condition & description</Text>
          </View>
        )}

        <Text style={labelStyle}>Title *</Text>
        <TextInput style={inputStyle} value={title} onChangeText={setTitle} placeholder="e.g. 2018 Mustang GT exhaust system..." placeholderTextColor={colors.textMuted} />

        <Text style={labelStyle}>Description</Text>
        <TextInput style={[inputStyle, { height: 100, textAlignVertical: "top" }]} value={description} onChangeText={setDescription} placeholder="Describe the part, fitment, any defects..." placeholderTextColor={colors.textMuted} multiline />

        <Text style={labelStyle}>Category *</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }} contentContainerStyle={{ gap: 8 }}>
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat} onPress={() => setCategory(cat)}
              style={{ backgroundColor: category === cat ? colors.blue : colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: category === cat ? colors.blue : colors.border }}>
              <Text style={{ color: category === cat ? "white" : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={labelStyle}>Condition *</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {CONDITIONS.map((cond) => (
            <TouchableOpacity key={cond} onPress={() => setCondition(cond)}
              style={{ backgroundColor: condition === cond ? colors.blue : colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: condition === cond ? colors.blue : colors.border }}>
              <Text style={{ color: condition === cond ? "white" : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>{cond}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={labelStyle}>Contact Preference *</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {["EMAIL", "PHONE", "BOTH"].map((pref) => (
            <TouchableOpacity key={pref} onPress={() => setContactPreference(pref)}
              style={{ backgroundColor: contactPreference === pref ? colors.blue : colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: contactPreference === pref ? colors.blue : colors.border }}>
              <Text style={{ color: contactPreference === pref ? "white" : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>
                {pref === "EMAIL" ? "📧 Email" : pref === "PHONE" ? "📞 Phone" : "📧📞 Both"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={labelStyle}>Listing Type *</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {PRICE_TYPES.map((type) => (
            <TouchableOpacity key={type} onPress={() => setPriceType(type)}
              style={{ backgroundColor: priceType === type ? colors.blue : colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: priceType === type ? colors.blue : colors.border }}>
              <Text style={{ color: priceType === type ? "white" : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>{PRICE_TYPE_LABELS[type]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {priceType !== "TRADE" && priceType !== "FREE" && (
          <>
            <Text style={labelStyle}>Price ($)</Text>
            <TextInput style={inputStyle} value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
