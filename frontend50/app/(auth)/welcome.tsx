import { useTheme } from "@context/ThemeContext";
import { router } from "expo-router";
import { Image, Text, TouchableOpacity, View } from "react-native";

export default function Welcome() {
  const { colors } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 }}>
      <Image
        source={require("../../assets/autoai_icon_1024_tm.png")}
        style={{ width: 220, height: 220, marginBottom: 16 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 16, color: colors.textSecondary, marginBottom: 60, textAlign: "center" }}>
        The social platform for car enthusiasts and mechanics
      </Text>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/login")}
        style={{ width: "100%", backgroundColor: colors.blue, paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 14 }}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>Login</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(auth)/register")}
        style={{ width: "100%", backgroundColor: colors.input, paddingVertical: 16, borderRadius: 12, alignItems: "center", borderWidth: 1, borderColor: colors.border }}
      >
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>Create Account</Text>
      </TouchableOpacity>

      <Text style={{ color: colors.textMuted, marginTop: 40, fontSize: 12, textAlign: "center" }}>
        For DIYers, Mechanics & Anyone who likes to get their hands dirty under the hood!
      </Text>
    </View>
  );
}