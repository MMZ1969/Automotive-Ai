import api from "@lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

export default function VerifyEmail() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    if (token) verifyToken();
  }, [token]);

  const verifyToken = async () => {
    try {
      const res = await api.get(`/api/auth/verify-email?token=${token}`);
      if (res.data.token) {
        await AsyncStorage.setItem("token", res.data.token);
        await AsyncStorage.setItem("user", JSON.stringify(res.data.user));
        api.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
      }
      setStatus("success");
      setTimeout(() => router.replace("/(tabs)/feed"), 2000);
    } catch (err) {
      setStatus("error");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center", padding: 30 }}>
      {status === "loading" && (
        <>
          <ActivityIndicator color="#345bff" size="large" />
          <Text style={{ color: "#9ca3af", marginTop: 20, fontSize: 15 }}>Verifying your email...</Text>
        </>
      )}
      {status === "success" && (
        <>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>✅</Text>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>Email Verified!</Text>
          <Text style={{ color: "#9ca3af", fontSize: 15, textAlign: "center" }}>Welcome to AutoAI 🚗 Taking you to the feed...</Text>
        </>
      )}
      {status === "error" && (
        <>
          <Text style={{ fontSize: 60, marginBottom: 20 }}>❌</Text>
          <Text style={{ color: "white", fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>Link Expired</Text>
          <Text style={{ color: "#9ca3af", fontSize: 15, textAlign: "center", marginBottom: 24 }}>This verification link is invalid or has expired.</Text>
          <TouchableOpacity
            onPress={() => router.replace("/(auth)/login")}
            style={{ backgroundColor: "#345bff", padding: 14, borderRadius: 12, paddingHorizontal: 30 }}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Back to Login</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
