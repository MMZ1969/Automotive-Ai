import api from "@lib/api";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    Text,
    View
} from "react-native";

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await api.get("/api/notifications");
      setNotifications(res.data);
      // Mark all as read
      await api.post("/api/notifications/mark-read");
    } catch (err) {
      console.error("FETCH NOTIFICATIONS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNotifications();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "like": return "❤️";
      case "comment": return "💬";
      case "follow": return "🚗";
      default: return "🔔";
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
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>
      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
      }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>
          🔔 Notifications
        </Text>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🔔</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginTop: 16 }}>
              No notifications yet
            </Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center" }}>
              When someone likes, comments, or follows you — it'll show up here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: item.read ? "#11131a" : "#0f1628",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: item.read ? "#252838" : "#345bff44",
            padding: 14,
            marginBottom: 10,
            gap: 12,
          }}>
            {/* ACTOR AVATAR */}
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: "#252838",
              justifyContent: "center",
              alignItems: "center",
              overflow: "hidden",
            }}>
              {item.actor?.profilePhoto ? (
                <Image
                  source={{ uri: item.actor.profilePhoto }}
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
              ) : (
                <Text style={{ fontSize: 18 }}>
                  {item.actor?.name?.[0]?.toUpperCase() || "?"}
                </Text>
              )}
            </View>

            {/* MESSAGE */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: "white", fontSize: 15, lineHeight: 20 }}>
                <Text style={{ fontWeight: "700" }}>{getIcon(item.type)} </Text>
                {item.message}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                {timeAgo(item.createdAt)}
              </Text>
            </View>

            {/* UNREAD DOT */}
            {!item.read && (
              <View style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: "#345bff",
              }} />
            )}
          </View>
        )}
      />
    </View>
  );
}