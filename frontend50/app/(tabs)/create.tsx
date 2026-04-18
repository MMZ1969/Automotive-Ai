import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function CreatePostScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePost = async () => {
    if (!content.trim()) {
      Alert.alert("Empty post", "Write something before posting!");
      return;
    }

    try {
      setSubmitting(true);
      await api.post("/api/posts", { content });
      setContent("");
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
    router.push("/(tabs)/feed");
  }}>
    <Text style={{ color: "#9ca3af", fontSize: 16 }}>Cancel</Text>
  </TouchableOpacity>
  <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>
    New Post
  </Text>
        <TouchableOpacity
          onPress={handlePost}
          disabled={submitting || !content.trim()}
          style={{
            backgroundColor: submitting || !content.trim() ? "#1f2937" : "#345bff",
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
              Post
            </Text>
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

      {/* TEXT INPUT */}
      <TextInput
        value={content}
        onChangeText={setContent}
        placeholder="Share a build, ask a question, or post a tip..."
        placeholderTextColor="#4b5563"
        multiline
        autoFocus
        style={{
          flex: 1,
          color: "white",
          fontSize: 18,
          lineHeight: 26,
          paddingHorizontal: 20,
          paddingTop: 20,
          textAlignVertical: "top",
        }}
      />

      {/* CHARACTER COUNT */}
      <View style={{
        paddingHorizontal: 20,
        paddingBottom: 30,
        alignItems: "flex-end",
      }}>
        <Text style={{ color: content.length > 280 ? "#f87171" : "#6b7280", fontSize: 13 }}>
          {content.length}/500
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}