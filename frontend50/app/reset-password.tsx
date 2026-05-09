import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) {
      Alert.alert("Missing fields", "Please fill in all fields.");
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert("Too short", "Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert("Passwords don't match", "Please make sure both passwords match.");
      return;
    }
    if (!token) {
      Alert.alert("Invalid link", "This reset link is invalid or expired.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/api/auth/reset-password", {
        token,
        newPassword,
      });
      Alert.alert("✅ Password Reset!", "Your password has been reset successfully. Please log in.", [
        { text: "Go to Login", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Something went wrong. Try again.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#050509" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>
          Reset Password
        </Text>
      </View>

      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>🔐</Text>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 8 }}>
          Set New Password
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 15, textAlign: "center", marginBottom: 32 }}>
          Enter your new password below.
        </Text>

        <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>New Password</Text>
        <TextInput
          value={newPassword}
          onChangeText={setNewPassword}
          placeholder="Enter new password"
          placeholderTextColor="#4b5563"
          secureTextEntry
          style={{
            backgroundColor: "#11131a",
            color: "white",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#252838",
            fontSize: 16,
            marginBottom: 20,
          }}
        />

        <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>Confirm New Password</Text>
        <TextInput
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm new password"
          placeholderTextColor="#4b5563"
          secureTextEntry
          style={{
            backgroundColor: "#11131a",
            color: "white",
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#252838",
            fontSize: 16,
            marginBottom: 32,
          }}
        />

        <TouchableOpacity
          onPress={handleReset}
          disabled={submitting}
          style={{
            backgroundColor: submitting ? "#1f2937" : "#345bff",
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          {submitting ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
              Reset Password
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}