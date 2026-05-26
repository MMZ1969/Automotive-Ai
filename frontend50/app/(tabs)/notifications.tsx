import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, RefreshControl, Text, TouchableOpacity, View
} from "react-native";

export default function Notifications() {
  const { colors } = useTheme();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchNotifications = async () => {
    try {
      await api.post("/api/notifications/mark-read");
      const res = await api.get("/api/notifications");
      setNotifications(res.data);
    } catch (err) { console.error("FETCH NOTIFICATIONS ERROR:", err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchNotifications(); };

  const handleNotificationPress = (item: any) => {
    switch (item.type) {
      case "like": case "comment": if (item.postId) router.push(`/(tabs)/post/${item.postId}`); break;
      case "follow": if (item.actorId) router.push(`/(tabs)/user/${item.actorId}`); break;
      case "bid": case "bid_accepted": router.push("/(tabs)/mechanic/jobs"); break;
    }
  };

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
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
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>Notifications</Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🔔</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>No notifications yet</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>When someone likes, comments, or follows you — it'll show up here.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleNotificationPress(item)}
            style={{
              flexDirection: "row", alignItems: "center",
              backgroundColor: item.read ? colors.card : colors.background,
              borderRadius: 14, borderWidth: 1,
              borderColor: item.read ? colors.border : colors.blue + "44",
              padding: 14, marginBottom: 10, gap: 12,
            }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
              {item.actor?.profilePhoto ? (
                <Image source={{ uri: item.actor.profilePhoto }} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                <Text style={{ fontSize: 18 }}>{item.actor?.name?.[0]?.toUpperCase() || "?"}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 20 }}>{item.message}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{timeAgo(item.createdAt)}</Text>
            </View>
            {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.blue }} />}
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
