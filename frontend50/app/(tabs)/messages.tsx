// frontend50/app/(tabs)/messages.tsx

import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function MessagesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New message modal
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);

  const fetchConversations = async () => {
    try {
      const res = await api.get("/api/messages/conversations");
      setConversations(res.data);
    } catch (err) {
      console.error("FETCH CONVERSATIONS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { fetchConversations(); }, []));

  const getOtherUser = (conv: any) => {
    return conv.user1?.id === user?.id ? conv.user2 : conv.user1;
  };

  const getLastMessage = (conv: any) => {
    return conv.messages?.[0];
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/api/users/search?q=${encodeURIComponent(text)}`);
      // Filter out yourself
      setSearchResults((res.data || []).filter((u: any) => u.id !== user?.id));
    } catch (err) {
      console.error("SEARCH ERROR:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleStartConversation = async (otherUser: any) => {
    setStarting(true);
    try {
      const res = await api.post("/api/messages/conversations", { otherUserId: otherUser.id });
      const convId = res.data.id;
      setShowNewMessage(false);
      setSearchQuery("");
      setSearchResults([]);
      router.push(`/(tabs)/chat/${convId}`);
    } catch (err) {
      console.error("START CONVERSATION ERROR:", err);
    } finally {
      setStarting(false);
    }
  };

  const closeModal = () => {
    setShowNewMessage(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={{
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: colors.border,
        flexDirection: "row", alignItems: "center", justifyContent: "space-between"
      }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>💬 Messages</Text>
        <TouchableOpacity
          onPress={() => setShowNewMessage(true)}
          style={{
            width: 36, height: 36, borderRadius: 18,
            backgroundColor: colors.blue, justifyContent: "center", alignItems: "center"
          }}
        >
          <Text style={{ color: "white", fontSize: 22, fontWeight: "300", lineHeight: 26 }}>+</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchConversations(); }} tintColor={colors.blue} />}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>💬</Text>
            <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>No messages yet</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
              Tap the + button to find someone and start a conversation!
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const other = getOtherUser(item);
          const lastMsg = getLastMessage(item);
          const hasUnread = item.unreadCount > 0;

          return (
            <TouchableOpacity
              onPress={() => router.push(`/(tabs)/chat/${item.id}`)}
              style={{
                flexDirection: "row", alignItems: "center", gap: 14,
                paddingHorizontal: 20, paddingVertical: 14,
                borderBottomWidth: 1, borderBottomColor: colors.border,
                backgroundColor: hasUnread ? colors.card : colors.background,
              }}
            >
              <View style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: colors.border, overflow: "hidden",
                justifyContent: "center", alignItems: "center",
                borderWidth: 2, borderColor: other?.role === "MECHANIC" ? colors.blue : colors.green,
              }}>
                {other?.profilePhoto ? (
                  <Image source={{ uri: other.profilePhoto }} style={{ width: 52, height: 52 }} />
                ) : (
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold" }}>{other?.name?.[0]?.toUpperCase()}</Text>
                )}
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                  <Text style={{ color: colors.text, fontWeight: hasUnread ? "800" : "600", fontSize: 15 }}>{other?.name}</Text>
                  {lastMsg && (
                    <Text style={{ color: colors.textMuted, fontSize: 11 }}>
                      {new Date(lastMsg.createdAt).toLocaleDateString()}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text numberOfLines={1} style={{ color: hasUnread ? colors.text : colors.textSecondary, fontSize: 13, flex: 1, fontWeight: hasUnread ? "600" : "400" }}>
                    {lastMsg ? (lastMsg.senderId === user?.id ? `You: ${lastMsg.content}` : lastMsg.content) : "Start a conversation"}
                  </Text>
                  {hasUnread && (
                    <View style={{ backgroundColor: colors.blue, borderRadius: 10, minWidth: 20, height: 20, justifyContent: "center", alignItems: "center", paddingHorizontal: 5, marginLeft: 8 }}>
                      <Text style={{ color: "white", fontSize: 11, fontWeight: "700" }}>{item.unreadCount}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* NEW MESSAGE MODAL */}
      <Modal
        visible={showNewMessage}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1, backgroundColor: colors.background }}
        >
          {/* MODAL HEADER */}
          <View style={{
            paddingTop: 20, paddingHorizontal: 20, paddingBottom: 16,
            borderBottomWidth: 1, borderBottomColor: colors.border,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between"
          }}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={{ color: colors.blue, fontSize: 16 }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ color: colors.text, fontSize: 17, fontWeight: "700" }}>New Message</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* SEARCH BAR */}
          <View style={{
            flexDirection: "row", alignItems: "center", gap: 10,
            margin: 16, paddingHorizontal: 14, paddingVertical: 10,
            backgroundColor: colors.card, borderRadius: 12,
            borderWidth: 1, borderColor: colors.border,
          }}>
            <Text style={{ fontSize: 16 }}>🔍</Text>
            <TextInput
              autoFocus
              placeholder="Search users..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
              style={{ flex: 1, color: colors.text, fontSize: 15 }}
            />
            {searching && <ActivityIndicator size="small" color={colors.blue} />}
          </View>

          {/* RESULTS */}
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id.toString()}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              searchQuery.length >= 2 && !searching ? (
                <View style={{ alignItems: "center", marginTop: 40 }}>
                  <Text style={{ color: colors.textSecondary }}>No users found</Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => handleStartConversation(item)}
                disabled={starting}
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  paddingHorizontal: 20, paddingVertical: 12,
                  borderBottomWidth: 1, borderBottomColor: colors.border,
                }}
              >
                <View style={{
                  width: 46, height: 46, borderRadius: 23,
                  backgroundColor: colors.border, overflow: "hidden",
                  justifyContent: "center", alignItems: "center",
                  borderWidth: 2, borderColor: item.role === "MECHANIC" ? colors.blue : colors.green,
                }}>
                  {item.profilePhoto ? (
                    <Image source={{ uri: item.profilePhoto }} style={{ width: 46, height: 46 }} />
                  ) : (
                    <Text style={{ color: colors.text, fontSize: 18, fontWeight: "bold" }}>{item.name?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "600", fontSize: 15 }}>{item.name}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
                    {item.role === "MECHANIC" ? "🔧 Mechanic" : "🚗 DIYer"}
                  </Text>
                </View>
                {starting && <ActivityIndicator size="small" color={colors.blue} />}
              </TouchableOpacity>
            )}
          />
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}