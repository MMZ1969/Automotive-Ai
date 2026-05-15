import { router } from "expo-router";
import { Image, Text, TouchableOpacity, View } from "react-native";

export default function Welcome() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#050509",
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 30,
      }}
    >
      {/* LOGO */}
      <Image
        source={require("../../assets/autoai_icon_1024_tm.png")}
        style={{ width: 220, height: 220, marginBottom: 16 }}
        resizeMode="contain"
      />

      <Text style={{ fontSize: 16, color: "#9ca3af", marginBottom: 60, textAlign: "center" }}>
        The social platform for car enthusiasts and mechanics
      </Text>

      {/* Login Button */}
      <TouchableOpacity
        onPress={() => router.push("/(auth)/login")}
        style={{
          width: "100%",
          backgroundColor: "#345bff",
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
          Login
        </Text>
      </TouchableOpacity>

      {/* Sign Up Button */}
      <TouchableOpacity
        onPress={() => router.push("/(auth)/register")}
        style={{
          width: "100%",
          backgroundColor: "#11131a",
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#252838",
        }}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
          Create Account
        </Text>
      </TouchableOpacity>

      <Text style={{ color: "#4b5563", marginTop: 40, fontSize: 12, textAlign: "center" }}>
        For DIYers, Mechanics & Anyone who likes to get their hands dirty under the hood!
      </Text>
    </View>
  );
}