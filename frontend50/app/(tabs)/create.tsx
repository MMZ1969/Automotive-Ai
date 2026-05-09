import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { storage } from "../../firebaseConfig";

export default function CreatePostScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [postType, setPostType] = useState<"VANITY" | "QUESTION">("VANITY");

  const handlePickPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please allow access to your photo library.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      setImageUri(uri);
      await uploadToFirebase(uri);
    } catch (err) {
      console.error("PHOTO PICK ERROR:", err);
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const uploadToFirebase = async (uri: string) => {
    try {
      setUploading(true);
      setUploadProgress(0);
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `post-photos/${user?.id}/post_${Date.now()}.jpg`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      uploadTask.on(
        "state_changed",
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error("UPLOAD ERROR:", error);
          Alert.alert("Upload failed", "Please try again.");
          setUploading(false);
        },
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          setImageUrl(downloadURL);
          setUploading(false);
        }
      );
    } catch (err) {
      console.error("UPLOAD ERROR:", err);
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert("Empty post", "Write something before posting!");
      return;
    }
    if (uploading) {
      Alert.alert("Please wait", "Photo is still uploading...");
      return;
    }
    try {
      setSubmitting(true);
      console.log("POSTING WITH TYPE:", postType);
      await api.post("/api/posts", { content, imageUrl, postType });
      setContent("");
      setImageUri(null);
      setImageUrl(null);
      setPostType("VANITY");
      Alert.alert("Posted! 🚗", "Your post is live!", [
        { text: "View Feed", onPress: () => router.push("/(tabs)/feed") },
        { text: "Stay here" },
      ]);
    } catch (err) {
      console.error("CREATE POST ERROR:", err);
      Alert.alert("Error", "Could not create post. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#050509" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <TouchableOpacity onPress={() => {
          Keyboard.dismiss();
          setContent("");
          setImageUri(null);
          setImageUrl(null);
          router.push("/(tabs)/feed");
        }}>
          <Text style={{ color: "#9ca3af", fontSize: 16 }}>Cancel</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>
          New Post
        </Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={submitting || !content.trim() || uploading}
          style={{
            backgroundColor: submitting || !content.trim() || uploading ? "#1f2937" : "#345bff",
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>Post</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* ROLE BADGE */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#1f2937",
          justifyContent: "center",
          alignItems: "center",
          borderWidth: 2,
          borderColor: user?.role === "MECHANIC" ? "#345bff" : "#10b981",
        }}>
          <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
            {user?.name?.[0]?.toUpperCase() || "?"}
          </Text>
        </View>
        <View>
          <Text style={{ color: "white", fontWeight: "700" }}>{user?.name || "You"}</Text>
          <View style={{
            backgroundColor: user?.role === "MECHANIC" ? "#1e3a8a" : "#064e3b",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 10,
            alignSelf: "flex-start",
            marginTop: 3,
          }}>
            <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
              {user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
            </Text>
          </View>
        </View>
      </View>

      {/* POST TYPE SELECTOR */}
      <View style={{
        flexDirection: "row",
        paddingHorizontal: 20,
        paddingTop: 16,
        gap: 10,
      }}>
        <TouchableOpacity
          onPress={() => setPostType("VANITY")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: postType === "VANITY" ? "#10b981" : "#11131a",
            borderWidth: 1,
            borderColor: postType === "VANITY" ? "#10b981" : "#252838",
          }}
        >
          <Text style={{ fontSize: 16 }}>🚗</Text>
          <Text style={{
            color: postType === "VANITY" ? "white" : "#6b7280",
            fontWeight: "700",
            fontSize: 12,
            marginTop: 4,
          }}>Vanity</Text>
          <Text style={{
            color: postType === "VANITY" ? "#d1fae5" : "#4b5563",
            fontSize: 10,
            marginTop: 2,
          }}>Show off your ride</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setPostType("QUESTION")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 12,
            alignItems: "center",
            backgroundColor: postType === "QUESTION" ? "#345bff" : "#11131a",
            borderWidth: 1,
            borderColor: postType === "QUESTION" ? "#345bff" : "#252838",
          }}
        >
          <Text style={{ fontSize: 16 }}>🔧</Text>
          <Text style={{
            color: postType === "QUESTION" ? "white" : "#6b7280",
            fontWeight: "700",
            fontSize: 12,
            marginTop: 4,
          }}>Question</Text>
          <Text style={{
            color: postType === "QUESTION" ? "#dbeafe" : "#4b5563",
            fontSize: 10,
            marginTop: 2,
          }}>Ask the community</Text>
        </TouchableOpacity>
      </View>

      {/* TEXT INPUT */}
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder={postType === "QUESTION"
          ? "Ask the community a car question..."
          : "Share a build, mod, or car moment..."}
        placeholderTextColor="#4b5563"
        multiline
        autoFocus
        style={{
          color: "white",
          fontSize: 18,
          lineHeight: 26,
          paddingHorizontal: 20,
          paddingTop: 20,
          minHeight: 120,
          textAlignVertical: "top",
        }}
      />

      {/* IMAGE PREVIEW */}
      {imageUri && (
        <View style={{ paddingHorizontal: 20, marginTop: 10 }}>
          <Image
            source={{ uri: imageUri }}
            style={{ width: "100%", height: 200, borderRadius: 12 }}
            resizeMode="cover"
          />
          {uploading && (
            <View style={{
              position: "absolute",
              top: 0, left: 20, right: 0, bottom: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 12,
              justifyContent: "center",
              alignItems: "center",
            }}>
              <ActivityIndicator color="white" />
              <Text style={{ color: "white", marginTop: 8 }}>{uploadProgress}%</Text>
            </View>
          )}
          {!uploading && (
            <TouchableOpacity
              onPress={() => { setImageUri(null); setImageUrl(null); }}
              style={{
                position: "absolute",
                top: 8, right: 8,
                backgroundColor: "rgba(0,0,0,0.7)",
                borderRadius: 12,
                paddingHorizontal: 10,
                paddingVertical: 4,
              }}
            >
              <Text style={{ color: "white", fontSize: 12 }}>✕ Remove</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* BOTTOM TOOLBAR */}
      <View style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: "#252838",
        marginTop: "auto",
      }}>
        <TouchableOpacity
          onPress={handlePickPhoto}
          disabled={uploading}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: "#11131a",
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#252838",
          }}
        >
          <Text style={{ fontSize: 16 }}>📷</Text>
          <Text style={{ color: "#9ca3af", fontSize: 13 }}>
            {uploading ? `Uploading ${uploadProgress}%` : "Add Photo"}
          </Text>
        </TouchableOpacity>

        <Text style={{
          color: content.length > 400 ? "#f87171" : "#6b7280",
          fontSize: 13,
          marginLeft: "auto",
        }}>
          {content.length}/500
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}