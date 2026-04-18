import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

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
        gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/feed")}>
          <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>
          Post
        </Text>
      </View>

      <FlatList
        data={post?.comments || []}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={
          <View>
            {/* POST CONTENT */}
            <View style={{
              backgroundColor: "#11131a",
              margin: 16,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 16,
            }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16, marginBottom: 4 }}>
                {post?.user?.name || "Anonymous"}
              </Text>
              <Text style={{ color: "#e5e7eb", fontSize: 15, lineHeight: 22 }}>
                {post?.content}
              </Text>
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
            <Text style={{ color: "#345bff", fontWeight: "700", marginBottom: 4 }}>
              {item.user?.name || "Anonymous"}
            </Text>
            <Text style={{ color: "#e5e7eb", fontSize: 14 }}>
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