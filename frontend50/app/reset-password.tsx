import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useTheme();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!newPassword.trim() || !confirmPassword.trim()) { Alert.alert("Missing fields", "Please fill in all fields."); return; }
    if (newPassword.length < 8) { Alert.alert("Too short", "Password must be at least 8 characters."); return; }
    if (!/[0-9]/.test(newPassword)) { Alert.alert("Add a number", "Password must contain at least one number."); return; }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword)) { Alert.alert("Add a special character", "Password must contain at least one special character (!@#$%^&* etc)."); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Passwords don't match", "Please make sure both passwords match."); return; }
    if (!token) { Alert.alert("Invalid link", "This reset link is invalid or expired."); return; }
    try {
      setSubmitting(true);
      await api.post("/api/auth/reset-password", { token, newPassword });
      Alert.alert("✅ Password Reset!", "Your password has been reset successfully. Please log in.", [
        { text: "Go to Login", onPress: () => router.replace("/(auth)/login") },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { backgroundColor: colors.input, color: colors.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 16, marginBottom: 20 };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>Reset Password</Text>
      </View>

      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>🔐</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 8 }}>Set New Password</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center", marginBottom: 8 }}>Enter your new password below.</Text>
        <Text style={{ color: colors.textMuted, fontSize: 13, textAlign: "center", marginBottom: 32 }}>Must be at least 8 characters, with a number and a special character (!@#$%^&* etc).</Text>

        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>New Password</Text>
        <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Enter new password" placeholderTextColor={colors.textMuted} secureTextEntry style={inputStyle} />

        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Confirm New Password</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={colors.textMuted} secureTextEntry style={{ ...inputStyle, marginBottom: 32 }} />

        <TouchableOpacity onPress={handleReset} disabled={submitting} style={{ backgroundColor: submitting ? colors.card : colors.blue, paddingVertical: 16, borderRadius: 12, alignItems: "center" }}>
          {submitting ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Reset Password</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}