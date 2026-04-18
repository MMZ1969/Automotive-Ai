import { Stack } from "expo-router";
import { View } from "react-native";

export default function ProfileLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: "#050509" },
        }}
      />
    </View>
  );
}