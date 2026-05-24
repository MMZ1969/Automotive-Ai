import { useAuth } from "@context/AuthContext";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import api from "@lib/api";
import { Tabs, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Text, View } from "react-native";

export default function TabsLayout() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchUnread = async () => {
        try {
          const res = await api.get("/api/notifications/unread-count");
          setUnreadCount(res.data.count);
        } catch (err) {
          // silently fail
        }
      };
      fetchUnread();
      const interval = setInterval(fetchUnread, 30000);
      return () => clearInterval(interval);
    }, [])
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#0d0f17",
          borderTopColor: "#252838",
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
        },
        tabBarActiveTintColor: "#345bff",
        tabBarInactiveTintColor: "#6b7280",
      }}
    >
      {/* HIDDEN SCREENS */}
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="diyer/index" options={{ href: null }} />
      <Tabs.Screen name="mechanic/index" options={{ href: null }} />
      <Tabs.Screen name="post/[id]" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
      <Tabs.Screen name="user/[id]" options={{ href: null }} />
      <Tabs.Screen name="mechanic/jobs" options={{ href: null }} />
      <Tabs.Screen name="mechanic/reviews" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="followers" options={{ href: null }} />
      <Tabs.Screen name="near-me" options={{ href: null }} />

      {/* VISIBLE TABS */}
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="garage-open-variant"
              size={size}
              color={focused ? "#10b981" : "#6b7280"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="(parts)"
        options={{
          title: "Parts",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="car-wrench"
              size={size}
              color={focused ? "#f97316" : "#6b7280"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="diagnose"
        options={{
          title: "Diagnose",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="car-brake-alert"
              size={size}
              color={focused ? "#facc15" : "#6b7280"}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Alerts",
          tabBarIcon: ({ focused, size }) => (
            <View>
              <MaterialCommunityIcons
                name="bell"
                size={size}
                color={focused ? "#ef4444" : "#6b7280"}
              />
              {unreadCount > 0 && (
                <View style={{
                  position: "absolute",
                  top: -4,
                  right: -6,
                  backgroundColor: "#ef4444",
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  justifyContent: "center",
                  alignItems: "center",
                  paddingHorizontal: 3,
                }}>
                  <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused, size }) => (
            <MaterialCommunityIcons
              name="account-circle"
              size={size}
              color={focused ? "#345bff" : "#6b7280"}
            />
          ),
        }}
      />
    </Tabs>
  );
}
