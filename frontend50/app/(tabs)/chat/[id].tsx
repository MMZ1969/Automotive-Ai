import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
} from "react-native";

export default function ChatScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

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
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [conversationId]);

  const getOtherUser = () => {
    if (!conversation) return null;
    return conversation.user1?.id === user?.id ? conversation.user2 : conversation.user1;
  };

  const handleSend = async () => {
    if (!content.trim() || sending || !conversationId) return;
    try {
      setSending(true);
      const res = await api.post(`/api/messages/conversations/${conversationId}/messages`, { content });
      setMessages(prev => [...prev, res.data]);
      setContent("");
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (err) {
      console.error("SEND MESSAGE ERROR:", err);
    } finally {
      setSending(false);
    }
  };

  const otherUser = getOtherUser();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>

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
      </View>

      {/* MESSAGES */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id.toString()}
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
                paddingHorizontal: 14, paddingVertical: 10,
                borderWidth: isMe ? 0 : 1,
                borderColor: colors.border,
              }}>
                <Text style={{ color: isMe ? "white" : colors.text, fontSize: 15, lineHeight: 21 }}>{item.content}</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 3, marginHorizontal: 4 }}>
                {new Date(item.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              </Text>
            </View>
          );
        }}
      />

      {/* INPUT */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
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
          disabled={!content.trim() || sending}
          style={{ backgroundColor: !content.trim() || sending ? colors.border : colors.blue, width: 42, height: 42, borderRadius: 21, justifyContent: "center", alignItems: "center" }}
        >
          {sending ? <ActivityIndicator color="white" size="small" /> : <Text style={{ color: "white", fontSize: 18 }}>↑</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
