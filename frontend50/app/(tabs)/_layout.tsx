import { useAuth } from "@context/AuthContext";
import { Tabs } from "expo-router";
import { Text } from "react-native";

export default function TabsLayout() {
  const { user } = useAuth();
  const isMechanic = user?.role === "MECHANIC";

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

      {/* VISIBLE TABS */}
      <Tabs.Screen
        name="feed"
        options={{
          title: "Feed",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>🏠</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: "Post",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>➕</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="(profile)"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 20, color }}>👤</Text>
          ),
        }}
      />
      <Tabs.Screen
  name="search"
  options={{
    title: "Search",
    tabBarIcon: ({ color }) => (
      <Text style={{ fontSize: 20, color }}>🔍</Text>
    ),
  }}
/>
    </Tabs>
  );
}