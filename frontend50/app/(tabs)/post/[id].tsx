import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<any>(null); // the comment being replied to
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const replyInputRef = useRef<TextInput>(null);

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

  useEffect(() => { fetchPost(); }, [id]);

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

  const handleReply = async () => {
    if (!replyText.trim() || !replyingTo) return;
    try {
      setSubmittingReply(true);
      await api.post(`/api/posts/${id}/comments/${replyingTo.id}/reply`, { content: replyText });
      setReplyText("");
      setReplyingTo(null);
      fetchPost();
    } catch (err) {
      console.error("REPLY ERROR:", err);
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDelete = async () => {
    Alert.alert("Delete Post", "Are you sure? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await api.delete(`/api/posts/${id}`);
            router.push("/(tabs)/feed");
          } catch (err) {
            Alert.alert("Error", "Could not delete post. Try again.");
          }
        },
      },
    ]);
  };

  const handleEdit = () => {
    setEditContent(post?.content || "");
    setEditModalVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return;
    try {
      setSaving(true);
      await api.put(`/api/posts/${id}`, { content: editContent });
      setEditModalVisible(false);
      fetchPost();
      Alert.alert("✅ Post updated!");
    } catch (err) {
      Alert.alert("Error", "Could not update post. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleReport = () => {
    Alert.alert("Report Post", "Why are you reporting this post?", [
      { text: "Spam", onPress: () => submitReport("Spam") },
      { text: "Inappropriate Content", onPress: () => submitReport("Inappropriate Content") },
      { text: "Harassment", onPress: () => submitReport("Harassment") },
      { text: "Cancel", style: "cancel" },
    ]);
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

  // Only show top-level comments (no parentId)
  const topLevelComments = post?.comments?.filter((c: any) => !c.parentId) || [];

  // Get replies for a comment
  const getReplies = (commentId: number) =>
    post?.comments?.filter((c: any) => c.parentId === commentId) || [];

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
      {/* EDIT MODAL */}
<Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={() => setEditModalVisible(false)}>
  <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <TouchableOpacity style={{ flex: 1, backgroundColor: "#00000088" }} onPress={() => setEditModalVisible(false)} />
    <View style={{ backgroundColor: "#11131a", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
      <Text style={{ color: "white", fontSize: 20, fontWeight: "900", marginBottom: 16 }}>✏️ Edit Post</Text>
      <TextInput
        value={editContent}
        onChangeText={setEditContent}
        multiline autoFocus
        placeholder="What's on your mind?"
        placeholderTextColor="#4b5563"
        style={{
          backgroundColor: "#050509", color: "white",
          paddingHorizontal: 16, paddingVertical: 12,
          borderRadius: 12, borderWidth: 1, borderColor: "#345bff",
          fontSize: 15, lineHeight: 22, minHeight: 120,
          textAlignVertical: "top", marginBottom: 16,
        }}
      />
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 30 }}>
        <TouchableOpacity onPress={() => setEditModalVisible(false)} style={{ flex: 1, backgroundColor: "#252838", padding: 14, borderRadius: 12, alignItems: "center" }}>
          <Text style={{ color: "white", fontWeight: "700" }}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleSaveEdit} disabled={saving || !editContent.trim()} style={{ flex: 1, backgroundColor: saving || !editContent.trim() ? "#1f2937" : "#345bff", padding: 14, borderRadius: 12, alignItems: "center" }}>
          <Text style={{ color: "white", fontWeight: "700" }}>{saving ? "Saving..." : "Save"}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </KeyboardAvoidingView>
</Modal>

      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#252838", flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.push("/(tabs)/feed")}>
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>Post</Text>
        </View>
        {isMyPost ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <TouchableOpacity onPress={handleEdit} style={{ backgroundColor: "#0f1628", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#345bff44" }}>
              <Text style={{ color: "#345bff", fontSize: 13, fontWeight: "700" }}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={{ backgroundColor: "#1a0a0a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#ef444444" }}>
              <Text style={{ color: "#ef4444", fontSize: 13, fontWeight: "700" }}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={handleReport} style={{ backgroundColor: "#11131a", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: "#252838" }}>
            <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "700" }}>🚩 Report</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={topLevelComments}
        keyExtractor={(item) => item.id.toString()}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            {/* FULL POST CARD */}
            <View style={{ backgroundColor: "#11131a", margin: 16, borderRadius: 16, borderWidth: 1, borderColor: "#252838", padding: 16 }}>
              {/* POST TYPE BADGE */}
              <View style={{
                alignSelf: "flex-start",
                backgroundColor: post?.postType === "QUESTION" ? "#1e3a8a" : post?.postType === "SERVICE" ? "#78350f" : post?.postType === "BEFORE_AFTER" ? "#991b1b" : "#5b21b6",
                paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 12,
              }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
                  {post?.postType === "QUESTION" ? "🔧 Question" : post?.postType === "SERVICE" ? "🏁 Service" : post?.postType === "BEFORE_AFTER" ? "📸 Before/After" : "🚗 Vanity"}
                </Text>
              </View>

              {/* POST AUTHOR */}
              <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${post?.user?.id}`)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "#252838", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: post?.user?.role === "MECHANIC" ? "#345bff" : "#10b981", overflow: "hidden" }}>
                  {post?.user?.profilePhoto ? (
                    <Image source={{ uri: post.user.profilePhoto }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>{post?.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                  )}
                </View>
                <View>
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>{post?.user?.name || "Anonymous"}</Text>
                    {post?.user?.role === "MECHANIC" && post?.user?.isVerified ? (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: "#60a5fa", shadowColor: "#345bff", shadowOpacity: 0.4, shadowRadius: 4, elevation: 4, backgroundColor: "#1e3a8a" }}>
                        <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>🏁 Verified Mechanic</Text>
                      </View>
                    ) : (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: post?.user?.role === "MECHANIC" ? "#1e3a8a" : "#064e3b", borderWidth: 1, borderColor: post?.user?.role === "MECHANIC" ? "#345bff" : "#10b981" }}>
                        <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
                          {post?.user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>{post?.user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
                </View>
                <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: "auto" }}>{new Date(post?.createdAt).toLocaleDateString()}</Text>
              </TouchableOpacity>

              {/* POST CONTENT */}
              <Text style={{ color: "#e5e7eb", fontSize: 16, lineHeight: 24, marginBottom: 12 }}>{post?.content}</Text>

              {/* POST IMAGE */}
              {post?.imageUrl && (
                <Image source={{ uri: post.imageUrl }} style={{ width: "100%", height: 250, borderRadius: 12, marginBottom: 12 }} resizeMode="cover" />
              )}

              {post?.postType === "BEFORE_AFTER" && post?.beforeImageUrl && post?.afterImageUrl && (
                <View style={{ flexDirection: "row", gap: 6, marginTop: 10 }}>
                  <View style={{ flex: 1, borderRadius: 10, overflow: "hidden" }}>
                    <Image source={{ uri: post.beforeImageUrl }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", padding: 5, alignItems: "center" }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>BEFORE</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, borderRadius: 10, overflow: "hidden" }}>
                    <Image source={{ uri: post.afterImageUrl }} style={{ width: "100%", height: 180 }} resizeMode="cover" />
                    <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(16,185,129,0.6)", padding: 5, alignItems: "center" }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>AFTER</Text>
                    </View>
                  </View>
                </View>
              )}

              {/* LIKES */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#252838" }}>
                <Text style={{ fontSize: 16 }}>❤️</Text>
                <Text style={{ color: "#9ca3af", fontSize: 14 }}>{post?.likes?.length || 0} likes</Text>
                <Text style={{ color: "#9ca3af", fontSize: 14, marginLeft: 12 }}>💬 {post?.comments?.length || 0} comments</Text>
              </View>
            </View>

            {/* COMMENTS HEADER */}
            <Text style={{ color: "#9ca3af", fontSize: 14, paddingHorizontal: 20, marginBottom: 8 }}>
              {topLevelComments.length} Comment{topLevelComments.length !== 1 ? "s" : ""}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 40 }}>
            <Text style={{ color: "#6b7280", fontSize: 15 }}>No comments yet. Be the first!</Text>
          </View>
        }
        renderItem={({ item }) => {
          const replies = getReplies(item.id);
          const isReplying = replyingTo?.id === item.id;

          return (
            <View style={{ marginHorizontal: 16, marginBottom: 10 }}>
              {/* TOP LEVEL COMMENT */}
              <View style={{ backgroundColor: "#11131a", borderRadius: 12, borderWidth: 1, borderColor: "#252838", padding: 14 }}>
                <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${item.user?.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#252838", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: item.user?.role === "MECHANIC" ? "#345bff" : "#10b981" }}>
                    <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>{item.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                  </View>
                  <Text style={{ color: "#345bff", fontWeight: "700" }}>{item.user?.name || "Anonymous"}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 11, marginLeft: "auto" }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                </TouchableOpacity>

                <Text style={{ color: "#e5e7eb", fontSize: 14, paddingLeft: 36, marginBottom: 8 }}>{item.content}</Text>

                {/* REPLY BUTTON */}
                <TouchableOpacity
                  onPress={() => {
                    setReplyingTo(isReplying ? null : item);
                    setReplyText("");
                    setTimeout(() => replyInputRef.current?.focus(), 100);
                  }}
                  style={{ paddingLeft: 36 }}
                >
                  <Text style={{ color: isReplying ? "#ef4444" : "#6b7280", fontSize: 12, fontWeight: "700" }}>
                    {isReplying ? "✕ Cancel" : `💬 Reply${replies.length > 0 ? ` (${replies.length})` : ""}`}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* REPLIES */}
              {replies.length > 0 && (
                <View style={{ marginLeft: 24, marginTop: 6 }}>
                  {replies.map((reply: any) => (
                    <View key={reply.id} style={{ backgroundColor: "#0d0f18", borderRadius: 10, borderWidth: 1, borderColor: "#1e2235", padding: 12, marginBottom: 6 }}>
                      <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${reply.user?.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#252838", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: reply.user?.role === "MECHANIC" ? "#345bff" : "#10b981" }}>
                          <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>{reply.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                        </View>
                        <Text style={{ color: "#345bff", fontWeight: "700", fontSize: 13 }}>{reply.user?.name || "Anonymous"}</Text>
                        <Text style={{ color: "#6b7280", fontSize: 10, marginLeft: "auto" }}>{new Date(reply.createdAt).toLocaleDateString()}</Text>
                      </TouchableOpacity>
                      <Text style={{ color: "#e5e7eb", fontSize: 13, paddingLeft: 30 }}>{reply.content}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* INLINE REPLY INPUT */}
              {isReplying && (
                <View style={{ marginLeft: 24, marginTop: 6, flexDirection: "row", gap: 8, alignItems: "center" }}>
                  <TextInput
                    ref={replyInputRef}
                    value={replyText}
                    onChangeText={setReplyText}
                    placeholder={`Reply to ${item.user?.name}...`}
                    placeholderTextColor="#4b5563"
                    style={{
                      flex: 1, backgroundColor: "#0d0f18", color: "white",
                      paddingHorizontal: 14, paddingVertical: 8,
                      borderRadius: 16, borderWidth: 1, borderColor: "#345bff44", fontSize: 14,
                    }}
                  />
                  <TouchableOpacity
                    onPress={handleReply}
                    disabled={submittingReply || !replyText.trim()}
                    style={{ backgroundColor: submittingReply || !replyText.trim() ? "#1f2937" : "#345bff", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 }}
                  >
                    <Text style={{ color: "white", fontWeight: "700", fontSize: 13 }}>
                      {submittingReply ? "..." : "Send"}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* MAIN COMMENT INPUT */}
      <View style={{ flexDirection: "row", padding: 16, borderTopWidth: 1, borderTopColor: "#252838", gap: 10, alignItems: "center" }}>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Add a comment..."
          placeholderTextColor="#4b5563"
          style={{ flex: 1, backgroundColor: "#11131a", color: "white", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#252838" }}
        />
        <TouchableOpacity
          onPress={handleComment}
          disabled={submitting || !comment.trim()}
          style={{ backgroundColor: submitting || !comment.trim() ? "#1f2937" : "#345bff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>Post</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
