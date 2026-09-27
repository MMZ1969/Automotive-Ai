import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Alert, Text, TextInput, TouchableOpacity, View } from "react-native";

// Dedicated, always-reachable route for entering a verification code.
//
// This used to be inline state inside register.tsx (`needsVerification`),
// which meant it vanished the moment that screen unmounted — back button,
// app switch, force-close, anything. There was no way back in, and
// "Resend Code" on the old login.tsx screen sent a new email with
// literally nowhere in the app to type it. That's the bug: any account
// created via a route that isn't THIS one, or any user who bails on a
// register/login screen before verifying, is now permanently reachable
// again because both register.tsx and login.tsx push here with the
// email whenever the backend says needsVerification — regardless of how
// or when that happens.
export default function VerifyEmail() {
  const { completeVerification } = useAuth();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const email = typeof params.email === "string" ? params.email : "";

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (code.length !== 6) return;
    try {
      setVerifying(true);
      const res = await api.post("/api/auth/verify-email", { email, code });
      // verify-email already hands back a fresh token + user (same shape
      // as /login) — log the user straight in instead of making them
      // re-enter their password on a screen they just fought to reach.
      await completeVerification(res.data.token, res.data.user);
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Invalid or expired code. Try again.");
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      await api.post("/api/auth/resend-verification", { email });
      Alert.alert("✅ Sent!", "Check your inbox for your new verification code.");
    } catch (err) {
      Alert.alert("Error", "Could not resend. Try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 30 }}>
      <Text style={{ fontSize: 60, marginBottom: 20 }}>📧</Text>
      <Text style={{ color: colors.text, fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>Enter Your Code</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 24, marginBottom: 8 }}>We sent a 6-digit code to:</Text>
      <Text style={{ color: colors.blue, fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 24 }}>{email || "your email"}</Text>

      <TextInput
        placeholder="123456" placeholderTextColor={colors.textMuted}
        keyboardType="number-pad" maxLength={6} autoFocus
        style={{ backgroundColor: colors.input, color: colors.text, padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: colors.border, width: "100%", textAlign: "center", fontSize: 24, letterSpacing: 8, fontWeight: "700" }}
        value={code} onChangeText={setCode}
      />

      <TouchableOpacity
        onPress={handleVerify}
        disabled={verifying || code.length !== 6}
        style={{ backgroundColor: verifying || code.length !== 6 ? colors.card : colors.blue, padding: 16, borderRadius: 12, width: "100%", alignItems: "center", marginBottom: 12 }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
          {verifying ? "Verifying..." : "Verify & Continue"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleResend}
        disabled={resending}
        style={{ backgroundColor: colors.input, borderWidth: 1, borderColor: colors.blue, padding: 14, borderRadius: 12, width: "100%", alignItems: "center", marginBottom: 12 }}
      >
        <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 15 }}>
          {resending ? "Sending..." : "Resend Code"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
        <Text style={{ color: colors.textMuted, fontSize: 14, marginTop: 8 }}>Back to Login</Text>
      </TouchableOpacity>
    </View>
  );
}
