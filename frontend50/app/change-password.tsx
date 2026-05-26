import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) { Alert.alert("Missing fields", "Please fill in all fields."); return; }
    if (newPassword.length < 6) { Alert.alert("Too short", "New password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { Alert.alert("Passwords don't match", "New password and confirmation must match."); return; }
    try {
      setSubmitting(true);
      await api.put("/api/auth/change-password", { currentPassword, newPassword });
      Alert.alert("✅ Success", "Your password has been changed!", [{ text: "OK", onPress: () => router.back() }]);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Something went wrong. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle = { backgroundColor: colors.input, color: colors.text, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 16, marginBottom: 20 };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>Change Password</Text>
      </View>

      <View style={{ flex: 1, padding: 24 }}>
        <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>🔐</Text>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 32 }}>Update Your Password</Text>

        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Current Password</Text>
        <TextInput value={currentPassword} onChangeText={setCurrentPassword} placeholder="Enter current password" placeholderTextColor={colors.textMuted} secureTextEntry style={inputStyle} />

        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>New Password</Text>
        <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="Enter new password" placeholderTextColor={colors.textMuted} secureTextEntry style={inputStyle} />

        <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Confirm New Password</Text>
        <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm new password" placeholderTextColor={colors.textMuted} secureTextEntry style={{ ...inputStyle, marginBottom: 32 }} />

        <TouchableOpacity onPress={handleSubmit} disabled={submitting} style={{ backgroundColor: submitting ? colors.card : colors.blue, paddingVertical: 16, borderRadius: 12, alignItems: "center" }}>
          {submitting ? <ActivityIndicator color="white" /> : <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>Change Password</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}