import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { ensureFirebaseAuth } from "@lib/firebaseAuth";
import { ResizeMode, Video } from "expo-av";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useEffect, useRef, useState } from "react";
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
import ImageLightbox from "../../../components/ImageLightbox";
import { storage } from "../../../firebaseConfig";

export default function ChatScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  // Attachment state — mirrors the pattern used in create.tsx for
  // uploading photos, extended here to also allow a single video.
  const [attachmentUri, setAttachmentUri] = useState<string | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentType, setAttachmentType] = useState<"image" | "video" | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);

  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const conversationId = typeof id === "string" ? parseInt(id) : null;

  const fetchMessages = async () => {
    if (!conversationId) return;
    try {
      const res = await api.get(`/api/messages/conversations/${conversationId}/messages`);
      setMessages(res.data);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error("FETCH MESSAGES ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchConversation = async () => {
    if (!conversationId) return;
    try {
      const res = await api.get("/api/messages/conversations");
      const conv = res.data.find((c: any) => c.id === conversationId);
      setConversation(conv);
    } catch (err) {
      console.error("FETCH CONVERSATION ERROR:", err);
    }
  };

  useEffect(() => {
    fetchConversation();
    fetchMessages();
    // Poll for new messages every 5 seconds
    pollIntervalRef.current = setInterval(fetchMessages, 5000);
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [conversationId]);

  const getOtherUser = () => {
    if (!conversation) return null;
    return conversation.user1?.id === user?.id ? conversation.user2 : conversation.user1;
  };

  const handlePickAttachment = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permission needed", "Please allow access to your photo library."); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      const type: "image" | "video" = asset.type === "video" ? "video" : "image";
      setAttachmentUri(asset.uri);
      setAttachmentType(type);
      await uploadAttachment(asset.uri, type);
    } catch {
      Alert.alert("Error", "Could not open photo library.");
    }
  };

  const uploadAttachment = async (uri: string, type: "image" | "video") => {
    try {
      await ensureFirebaseAuth();
      setUploadingAttachment(true);
      setAttachmentProgress(0);
      const response = await fetch(uri);
      const blob = await response.blob();
      const ext = type === "video" ? "mp4" : "jpg";
      const filename = `message-media/${user?.id}/${Date.now()}.${ext}`;
      const storageRef = ref(storage, filename);
      const uploadTask = uploadBytesResumable(storageRef, blob);
      await new Promise<void>((resolve, reject) => {
        uploadTask.on("state_changed",
          (snapshot) => {
            setAttachmentProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          (err) => { reject(err); },
          async () => {
            const url = await getDownloadURL(uploadTask.snapshot.ref);
            setAttachmentUrl(url);
            resolve();
          }
        );
      });
    } catch {
      Alert.alert("Upload failed", "Could not upload attachment. Please try again.");
      setAttachmentUri(null);
      setAttachmentType(null);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const removeAttachment = () => {
    setAttachmentUri(null);
    setAttachmentUrl(null);
    setAttachmentType(null);
  };

  const handleSend = async () => {
    const hasText = content.trim().length > 0;
    const hasAttachment = !!attachmentUrl;
    if ((!hasText && !hasAttachment) || sending || !conversationId || uploadingAttachment) return;
    try {
      setSending(true);
      const res = await api.post(`/api/messages/conversations/${conversationId}/messages`, {
        content: content.trim(),
        mediaUrl: attachmentUrl || undefined,
        mediaType: attachmentType || undefined,
      });
      setMessages(prev => [...prev, res.data]);
      setContent("");
      removeAttachment();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error("SEND MESSAGE ERROR:", err);
      Alert.alert("Error", "Could not send message. Try again.");
    } finally {
      setSending(false);
    }
  };

  const otherUser = getOtherUser();

  const handleDeleteConversation = () => {
    Alert.alert("Delete Conversation", "This will permanently delete this conversation and all messages. Continue?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          await api.delete(`/api/messages/conversations/${conversationId}`);
          router.back();
        } catch (err) {
          console.error("DELETE CONVERSATION ERROR:", err);
          Alert.alert("Error", "Could not delete conversation.");
        }
      }},
    ]);
  };

  const handleBlockUser = () => {
    if (!otherUser) return;
    Alert.alert("Block User", `Block ${otherUser.name}? They won't be able to message you anymore.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: async () => {
        try {
          await api.post(`/api/users/${otherUser.id}/block`);
          Alert.alert("✅ Blocked", `${otherUser.name} has been blocked.`);
        } catch (err) {
          console.error("BLOCK USER ERROR:", err);
          Alert.alert("Error", "Could not block user.");
        }
      }},
    ]);
  };

  const handleMenuPress = () => {
    if (!otherUser) {
      handleDeleteConversation();
      return;
    }
    Alert.alert("Conversation Options", undefined, [
      { text: "Cancel", style: "cancel" },
      { text: "Block User", style: "destructive", onPress: handleBlockUser },
      { text: "Delete Conversation", style: "destructive", onPress: handleDeleteConversation },
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>

      {/* PHOTO ZOOM — single image at a time, matching how it's used in feed/post detail */}
      <ImageLightbox
        visible={lightboxVisible}
        images={lightboxImage ? [lightboxImage] : []}
        initialIndex={0}
        onClose={() => setLightboxVisible(false)}
      />

      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        {otherUser && (
          <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${otherUser.id}`)} style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: otherUser?.role === "MECHANIC" ? colors.blue : colors.green }}>
              {otherUser?.profilePhoto ? (
                <Image source={{ uri: otherUser.profilePhoto }} style={{ width: 38, height: 38 }} />
              ) : (
                <Text style={{ color: colors.text, fontSize: 16, fontWeight: "bold" }}>{otherUser?.name?.[0]?.toUpperCase()}</Text>
              )}
            </View>
            <View>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{otherUser?.name}</Text>
              <Text style={{ color: otherUser?.role === "MECHANIC" ? colors.blue : colors.green, fontSize: 11, fontWeight: "600" }}>
                {otherUser?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
              </Text>
            </View>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleMenuPress} style={{ padding: 4 }}>
          <Text style={{ fontSize: 24, color: colors.text, fontWeight: "900" }}>⋯</Text>
        </TouchableOpacity>
      </View>

      {/* MESSAGES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 40 }}>👋</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 12, textAlign: "center" }}>
              Say hello to {otherUser?.name}!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id;
          return (
            <View style={{ alignItems: isMe ? "flex-end" : "flex-start" }}>
              <View style={{
                maxWidth: "75%",
                backgroundColor: isMe ? colors.blue : colors.card,
                borderRadius: 18,
                borderBottomRightRadius: isMe ? 4 : 18,
                borderBottomLeftRadius: isMe ? 18 : 4,
                overflow: "hidden",
                borderWidth: isMe ? 0 : 1,
                borderColor: colors.border,
              }}>
                {item.mediaUrl && item.mediaType === "image" && (
                  <TouchableOpacity onPress={() => { setLightboxImage(item.mediaUrl); setLightboxVisible(true); }} activeOpacity={0.85}>
                    <Image source={{ uri: item.mediaUrl }} style={{ width: 220, height: 220 }} resizeMode="cover" />
                  </TouchableOpacity>
                )}
                {item.mediaUrl && item.mediaType === "video" && (
                  <Video
                    source={{ uri: item.mediaUrl }}
                    style={{ width: 220, height: 220 }}
                    useNativeControls
                    resizeMode={ResizeMode.COVER}
                    isLooping={false}
                  />
                )}
                {item.content ? (
                  <Text style={{
                    color: isMe ? "white" : colors.text, fontSize: 15, lineHeight: 21,
                    paddingHorizontal: 14, paddingVertical: 10,
                  }}>
                    {item.content}
                  </Text>
                ) : item.mediaUrl ? (
                  // Media-only message still needs bottom padding inside the bubble
                  <View style={{ height: 8 }} />
                ) : null}
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3, marginHorizontal: 4 }}>
                {new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
      />

      {/* ATTACHMENT PREVIEW — shown above the input bar while composing */}
      {attachmentUri && (
        <View style={{ paddingHorizontal: 16, paddingTop: 10, flexDirection: "row", alignItems: "center", gap: 10 }}>
          <View style={{ width: 60, height: 60, borderRadius: 10, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
            {attachmentType === "video" ? (
              <Video source={{ uri: attachmentUri }} style={{ width: "100%", height: "100%" }} resizeMode={ResizeMode.COVER} />
            ) : (
              <Image source={{ uri: attachmentUri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            )}
            {uploadingAttachment && (
              <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center" }}>
                <ActivityIndicator color="white" size="small" />
                <Text style={{ color: "white", fontSize: 10, marginTop: 2 }}>{attachmentProgress}%</Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={removeAttachment} style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700" }}>✕ Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* INPUT */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
        <TouchableOpacity
          onPress={handlePickAttachment}
          disabled={uploadingAttachment || !!attachmentUri}
          style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, justifyContent: "center", alignItems: "center" }}
        >
          <Text style={{ fontSize: 18 }}>📎</Text>
        </TouchableOpacity>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Message..."
          placeholderTextColor={colors.textMuted}
          style={{ flex: 1, backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, borderWidth: 1, borderColor: colors.border, fontSize: 15, maxHeight: 100 }}
          multiline
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          onPress={handleSend}
          disabled={(!content.trim() && !attachmentUrl) || sending || uploadingAttachment}
          style={{ backgroundColor: (!content.trim() && !attachmentUrl) || sending || uploadingAttachment ? colors.border : colors.blue, width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" }}
        >
          {sending ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontSize: 18 }}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
