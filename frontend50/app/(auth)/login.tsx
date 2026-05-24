import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setNeedsVerification(false);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.needsVerification) {
        setNeedsVerification(true);
        setError("Please verify your email before logging in.");
      } else {
        setError("Login failed. Check your credentials.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      await api.post("/api/auth/resend-verification", { email });
      Alert.alert("✅ Sent!", "Check your inbox for a new verification link.");
    } catch (err) {
      Alert.alert("Error", "Could not resend. Try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center", paddingHorizontal: 30 }}>
      <Image
        source={require("../../assets/autoai_icon_1024_tm.png")}
        style={{ width: 200, height: 200, marginBottom: 8 }}
        resizeMode="contain"
      />
      <Text style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>
        The social platform for car enthusiasts
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ width: "100%", backgroundColor: "#11131a", color: "white", paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: "#252838" }}
      />

      {/* PASSWORD WITH EYE ICON */}
      <View style={{ width: "100%", flexDirection: "row", alignItems: "center", backgroundColor: "#11131a", borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: "#252838" }}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor="#6b7280"
          secureTextEntry={!showPassword}
          style={{ flex: 1, color: "white", paddingHorizontal: 16, paddingVertical: 12 }}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

      {/* FORGOT PASSWORD */}
      <TouchableOpacity onPress={() => router.push("/forgot-password")} style={{ alignSelf: "flex-end", marginBottom: 16 }}>
        <Text style={{ color: "#345bff", fontSize: 13 }}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* ERROR */}
      {error && (
        <Text style={{ color: "#f87171", marginBottom: 12, textAlign: "center" }}>{error}</Text>
      )}

      {/* NEEDS VERIFICATION — resend button */}
      {needsVerification && (
        <TouchableOpacity
          onPress={handleResend}
          disabled={resending}
          style={{ backgroundColor: "#11131a", borderWidth: 1, borderColor: "#345bff", padding: 12, borderRadius: 10, width: "100%", alignItems: "center", marginBottom: 12 }}
        >
          <Text style={{ color: "#345bff", fontWeight: "700" }}>
            {resending ? "Sending..." : "📧 Resend Verification Email"}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        onPress={handleLogin}
        disabled={submitting}
        style={{ width: "100%", backgroundColor: submitting ? "#1f2937" : "#345bff", paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 16 }}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text style={{ color: "#3b82f6", fontSize: 15 }}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}
