import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    Text,
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
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900" }}>💬 Messages</Text>
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
              Visit someone's profile and tap Message to start a conversation!
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
              {/* AVATAR */}
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

              {/* CONTENT */}
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
    </View>
  );
}
