import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useState } from "react";
import {
  ActivityIndicator, Alert, Image, Keyboard, KeyboardAvoidingView,
  Platform, ScrollView, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { storage } from "../../firebaseConfig";

export default function CreatePostScreen() {
  const { user, isMechanic } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [postType, setPostType] = useState<"VANITY" | "QUESTION" | "SERVICE" | "BEFORE_AFTER">("VANITY");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceLocation, setServiceLocation] = useState("");
  const [beforeUri, setBeforeUri] = useState<string | null>(null);
  const [beforeUrl, setBeforeUrl] = useState<string | null>(null);
  const [afterUri, setAfterUri] = useState<string | null>(null);
  const [afterUrl, setAfterUrl] = useState<string | null>(null);
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [beforeProgress, setBeforeProgress] = useState(0);
  const [afterProgress, setAfterProgress] = useState(0);

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Please allow access to your photo library."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, quality: 0.7 });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setImageUri(uri);
      await uploadToFirebase(uri, "main");
    } catch { Alert.alert("Error", "Could not open photo library."); }
  };

  const handlePickBeforeAfter = async (slot: "before" | "after") => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Please allow access to your photo library."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      if (slot === "before") setBeforeUri(uri);
      else setAfterUri(uri);
      await uploadToFirebase(uri, slot);
    } catch { Alert.alert("Error", "Could not open photo library."); }
  };

  const uploadToFirebase = async (uri: string, slot: "main" | "before" | "after") => {
    try {
      if (slot === "before") { setUploadingBefore(true); setBeforeProgress(0); }
      else if (slot === "after") { setUploadingAfter(true); setAfterProgress(0); }
      else { setUploading(true); setUploadProgress(0); }
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `post-photos/${user?.id}/${slot}_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      uploadTask.on("state_changed",
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (slot === "before") setBeforeProgress(progress);
          else if (slot === "after") setAfterProgress(progress);
          else setUploadProgress(progress);
        },
        () => {
          Alert.alert("Upload failed", "Please try again.");
          if (slot === "before") setUploadingBefore(false);
          else if (slot === "after") setUploadingAfter(false);
          else setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (slot === "before") { setBeforeUrl(downloadURL); setUploadingBefore(false); }
          else if (slot === "after") { setAfterUrl(downloadURL); setUploadingAfter(false); }
          else { setImageUrl(downloadURL); setUploading(false); }
        }
      );
    } catch {
      if (slot === "before") setUploadingBefore(false);
      else if (slot === "after") setUploadingAfter(false);
      else setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim()) { Alert.alert("Empty post", "Write something before posting!"); return; }
    if (postType === "BEFORE_AFTER" && (!beforeUrl || !afterUrl)) { Alert.alert("Missing photos", "Please add both a Before and After photo!"); return; }
    if (uploading || uploadingBefore || uploadingAfter) { Alert.alert("Please wait", "Photos are still uploading..."); return; }
    try {
      setSubmitting(true);
      await api.post("/api/posts", {
        content, imageUrl: postType === "BEFORE_AFTER" ? null : imageUrl, postType,
        servicePrice: postType === "SERVICE" ? servicePrice : null,
        serviceLocation: postType === "SERVICE" ? serviceLocation : null,
        beforeImageUrl: postType === "BEFORE_AFTER" ? beforeUrl : null,
        afterImageUrl: postType === "BEFORE_AFTER" ? afterUrl : null,
      });
      setContent(""); setImageUri(null); setImageUrl(null);
      setBeforeUri(null); setBeforeUrl(null); setAfterUri(null); setAfterUrl(null);
      setPostType("VANITY"); setServicePrice(""); setServiceLocation("");
      Alert.alert("Posted! 🚗", "Your post is live!", [
        { text: "View Feed", onPress: () => router.push("/(tabs)/feed") },
        { text: "Stay here" },
      ]);
    } catch { Alert.alert("Error", "Could not create post. Try again."); }
    finally { setSubmitting(false); }
  };

  const isUploading = uploading || uploadingBefore || uploadingAfter;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setContent(""); setImageUri(null); setImageUrl(null); router.push("/(tabs)/feed"); }}>
          <Text style={{ color: colors.textSecondary, fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>New Post</Text>
        <TouchableOpacity onPress={handlePost} disabled={submitting || !content.trim() || isUploading}
          style={{ backgroundColor: submitting || !content.trim() || isUploading ? colors.border : colors.blue, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 }}>
          {submitting ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Post</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView keyboardShouldPersistTaps="handled">
        {/* ROLE BADGE */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: user?.role === "MECHANIC" ? colors.blue : colors.green }}>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>{user?.name?.[0]?.toUpperCase() || "?"}</Text>
          </View>
          <View>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{user?.name || "You"}</Text>
            <View style={{ backgroundColor: user?.role === "MECHANIC" ? "#1e3a8a" : "#064e3b", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start", marginTop: 3 }}>
              <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
            </View>
          </View>
        </View>

        {/* POST TYPE SELECTOR */}
        <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 8, display: "flex", flexDirection: "row", flexWrap: "wrap" }}>
          {[
            { type: "VANITY", emoji: "🚗", label: "Vanity", sub: "Show off your ride", color: "#7c3aed" },
            { type: "QUESTION", emoji: "🔧", label: "Question", sub: "Ask the community", color: "#345bff" },
            { type: "BEFORE_AFTER", emoji: "📸", label: "Before/After", sub: "Show the transformation", color: "#ef4444" },
            ...(isMechanic ? [{ type: "SERVICE", emoji: "🏁", label: "Service", sub: "Offer your services", color: "#f59e0b" }] : []),
          ].map((item) => (
            <TouchableOpacity key={item.type} onPress={() => setPostType(item.type as any)}
              style={{ flex: 1, minWidth: "47%", paddingVertical: 10, borderRadius: 12, alignItems: "center", backgroundColor: postType === item.type ? item.color : colors.card, borderWidth: 1, borderColor: postType === item.type ? item.color : colors.border, marginBottom: 4 }}>
              <Text style={{ fontSize: 16 }}>{item.emoji}</Text>
              <Text style={{ color: postType === item.type ? "white" : colors.textMuted, fontWeight: "700", fontSize: 12, marginTop: 4 }}>{item.label}</Text>
              <Text style={{ color: postType === item.type ? "rgba(255,255,255,0.7)" : colors.textMuted, fontSize: 10, marginTop: 2 }}>{item.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* SERVICE FIELDS */}
        {postType === "SERVICE" && (
          <View style={{ paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
            <TextInput value={serviceLocation} onChangeText={setServiceLocation} placeholder="Service Location (e.g. South Jersey, NJ)" placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 15 }} />
            <TextInput value={servicePrice} onChangeText={setServicePrice} placeholder="Price / Rate (e.g. $75/hr)" placeholderTextColor={colors.textMuted} style={{ backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 15 }} />
          </View>
        )}

        {/* BEFORE/AFTER PHOTO PICKERS */}
        {postType === "BEFORE_AFTER" && (
          <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>Add your before and after photos</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => handlePickBeforeAfter("before")}
                style={{ flex: 1, height: 140, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1.5, borderColor: beforeUri ? "#ef4444" : colors.border, borderStyle: beforeUri ? "solid" : "dashed", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                {beforeUri ? (
                  <View style={{ width: "100%", height: "100%" }}>
                    <Image source={{ uri: beforeUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    {uploadingBefore && (
                      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator color="white" />
                        <Text style={{ color: "white", fontSize: 12, marginTop: 4 }}>{beforeProgress}%</Text>
                      </View>
                    )}
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", padding: 6, alignItems: "center" }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>BEFORE</Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 28 }}>📷</Text>
                    <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 13, marginTop: 6 }}>BEFORE</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Tap to add</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={{ justifyContent: "center", alignItems: "center" }}>
                <Text style={{ color: "#ef4444", fontSize: 22 }}>→</Text>
              </View>
              <TouchableOpacity onPress={() => handlePickBeforeAfter("after")}
                style={{ flex: 1, height: 140, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1.5, borderColor: afterUri ? "#10b981" : colors.border, borderStyle: afterUri ? "solid" : "dashed", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                {afterUri ? (
                  <View style={{ width: "100%", height: "100%" }}>
                    <Image source={{ uri: afterUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                    {uploadingAfter && (
                      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}>
                        <ActivityIndicator color="white" />
                        <Text style={{ color: "white", fontSize: 12, marginTop: 4 }}>{afterProgress}%</Text>
                      </View>
                    )}
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.6)", padding: 6, alignItems: "center" }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>AFTER</Text>
                    </View>
                  </View>
                ) : (
                  <View style={{ alignItems: "center" }}>
                    <Text style={{ fontSize: 28 }}>📷</Text>
                    <Text style={{ color: "#10b981", fontWeight: "700", fontSize: 13, marginTop: 6 }}>AFTER</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 11, marginTop: 2 }}>Tap to add</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TEXT INPUT */}
        <TextInput
          value={content} onChangeText={setContent}
          placeholder={
            postType === "QUESTION" ? "Ask the community a car question..."
            : postType === "SERVICE" ? "Describe the service you're offering..."
            : postType === "BEFORE_AFTER" ? "Describe the transformation..."
            : "Share a build, mod, or car moment..."
          }
          placeholderTextColor={colors.textMuted} multiline
          style={{ color: colors.text, fontSize: 18, lineHeight: 26, paddingHorizontal: 20, paddingTop: 20, minHeight: 120, textAlignVertical: "top" }}
        />

        {imageUri && postType !== "BEFORE_AFTER" && (
          <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
            <Image source={{ uri: imageUri }} style={{ width: "100%", height: 200, borderRadius: 12 }} resizeMode="cover" />
            {uploading && (
              <View style={{ position: "absolute", top: 0, left: 20, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 12, justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator color="white" />
                <Text style={{ color: "white", marginTop: 8 }}>{uploadProgress}%</Text>
              </View>
            )}
            {!uploading && (
              <TouchableOpacity onPress={() => { setImageUri(null); setImageUrl(null); }} style={{ position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: "white", fontSize: 12 }}>✕ Remove</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {postType !== "BEFORE_AFTER" && (
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12 }}>
            <TouchableOpacity onPress={handlePickPhoto} disabled={uploading}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.card, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: colors.border }}>
              <Text style={{ fontSize: 16 }}>📷</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{uploading ? `Uploading ${uploadProgress}%` : "Add Photo"}</Text>
            </TouchableOpacity>
            <Text style={{ color: content.length > 400 ? "#f87171" : colors.textMuted, fontSize: 13, marginLeft: "auto" }}>{content.length}/500</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
