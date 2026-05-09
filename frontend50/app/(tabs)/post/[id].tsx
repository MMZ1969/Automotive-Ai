import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function PostDetail() {
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<any>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPost = async () => {
    try {
      const res = await api.get(`/api/posts/${id}`);
      setPost(res.data);
    } catch (err) {
      console.error("FETCH POST ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [id]);

  const handleComment = async () => {
    if (!comment.trim()) return;
    try {
      setSubmitting(true);
      await api.post(`/api/posts/${id}/comments`, { content: comment });
      setComment("");
      fetchPost();
    } catch (err) {
      console.error("COMMENT ERROR:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert(
      "Delete Post",
      "Are you sure you want to delete this post? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/api/posts/${id}`);
              router.push("/(tabs)/feed");
            } catch (err) {
              console.error("DELETE ERROR:", err);
              Alert.alert("Error", "Could not delete post. Try again.");
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    Alert.alert(
      "Report Post",
      "Why are you reporting this post?",
      [
        { text: "Spam", onPress: () => submitReport("Spam") },
        { text: "Inappropriate Content", onPress: () => submitReport("Inappropriate Content") },
        { text: "Harassment", onPress: () => submitReport("Harassment") },
        { text: "Cancel", style: "cancel" },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    try {
      await api.post(`/api/posts/${id}/report`, { reason });
      Alert.alert("✅ Reported", "Thank you. We'll review this post within 24 hours.");
    } catch (err: any) {
      if (err?.response?.status === 400) {
        Alert.alert("Already Reported", "You've already reported this post.");
      } else {
        Alert.alert("Error", "Could not submit report. Try again.");
      }
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  const isMyPost = post?.user?.id === user?.id;

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
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/feed")}>
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>Post</Text>
        </View>

        {isMyPost ? (
          <TouchableOpacity
            onPress={handleDelete}
            style={{
              backgroundColor: "#1a0a0a",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#ef444444",
            }}
          >
            <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "700" }}>🗑️ Delete</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleReport}
            style={{
              backgroundColor: "#11131a",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 10,
              borderWidth: 1,
              borderColor: "#252838",
            }}
          >
            <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "700" }}>🚩 Report</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={post?.comments || []}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View>
            {/* FULL POST CARD */}
            <View style={{
              backgroundColor: "#11131a",
              margin: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 16,
            }}>
              {/* POST TYPE BADGE */}
              <View style={{
                alignSelf: "flex-start",
                backgroundColor: post?.postType === "QUESTION" ? "#1e3a8a" : "#064e3b",
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 10,
                marginBottom: 12,
              }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
                  {post?.postType === "QUESTION" ? "🔧 Question" : "🚗 Vanity"}
                </Text>
              </View>

              {/* POST AUTHOR */}
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/user/${post?.user?.id}`)}
                style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}
              >
                <View style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#252838",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 2,
                  borderColor: post?.user?.role === "MECHANIC" ? "#345bff" : "#10b981",
                  overflow: "hidden",
                }}>
                  {post?.user?.profilePhoto ? (
                    <Image
                      source={{ uri: post.user.profilePhoto }}
                      style={{ width: 44, height: 44, borderRadius: 22 }}
                    />
                  ) : (
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
                      {post?.user?.name?.[0]?.toUpperCase() || "?"}
                    </Text>
                  )}
                </View>
                <View>
                  <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                    {post?.user?.name || "Anonymous"}
                  </Text>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>
                    {post?.user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
                  </Text>
                </View>
                <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: "auto" }}>
                  {new Date(post?.createdAt).toLocaleDateString()}
                </Text>
              </TouchableOpacity>

              {/* POST CONTENT */}
              <Text style={{ color: "#e5e7eb", fontSize: 16, lineHeight: 24, marginBottom: 12 }}>
                {post?.content}
              </Text>

              {/* POST IMAGE */}
              {post?.imageUrl && (
                <Image
                  source={{ uri: post.imageUrl }}
                  style={{ width: "100%", height: 250, borderRadius: 12, marginBottom: 12 }}
                  resizeMode="cover"
                />
              )}

              {/* LIKES */}
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingTop: 12,
                borderTopWidth: 1,
                borderTopColor: "#252838",
              }}>
                <Text style={{ fontSize: 16 }}>❤️</Text>
                <Text style={{ color: "#9ca3af", fontSize: 14 }}>
                  {post?.likes?.length || 0} likes
                </Text>
                <Text style={{ color: "#9ca3af", fontSize: 14, marginLeft: 12 }}>
                  💬 {post?.comments?.length || 0} comments
                </Text>
              </View>
            </View>

            {/* COMMENTS HEADER */}
            <Text style={{ color: "#9ca3af", fontSize: 14, paddingHorizontal: 20, marginBottom: 8 }}>
              {post?.comments?.length || 0} Comments
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ color: "#6b7280", fontSize: 15 }}>No comments yet. Be the first!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: "#11131a",
            marginHorizontal: 16,
            marginBottom: 10,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#252838",
            padding: 14,
          }}>
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/user/${item.user?.id}`)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}
            >
              <View style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "#252838",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 1,
                borderColor: item.user?.role === "MECHANIC" ? "#345bff" : "#10b981",
              }}>
                <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
                  {item.user?.name?.[0]?.toUpperCase() || "?"}
                </Text>
              </View>
              <Text style={{ color: "#345bff", fontWeight: "700" }}>
                {item.user?.name || "Anonymous"}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 11, marginLeft: "auto" }}>
                {new Date(item.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>

            <Text style={{ color: "#e5e7eb", fontSize: 14, paddingLeft: 36 }}>
              {item.content}
            </Text>
          </View>
        )}
      />

      {/* COMMENT INPUT */}
      <View style={{
        flexDirection: "row",
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: "#252838",
        gap: 10,
        alignItems: "center",
      }}>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment..."
          placeholderTextColor="#4b5563"
          style={{
            flex: 1,
            backgroundColor: "#11131a",
            color: "white",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "#252838",
          }}
        />
        <TouchableOpacity
          onPress={handleComment}
          disabled={submitting || !comment.trim()}
          style={{
            backgroundColor: submitting || !comment.trim() ? "#1f2937" : "#345bff",
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 20,
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Post</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}