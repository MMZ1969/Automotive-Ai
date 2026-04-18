import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen name="create" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="(profile)" options={{ href: null }} />
      <Tabs.Screen name="diyer/index" options={{ href: null }} />
      <Tabs.Screen name="mechanic/index" options={{ href: null }} />
    </Tabs>
  );
}