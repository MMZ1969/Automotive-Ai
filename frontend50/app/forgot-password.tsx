import api from "@lib/api";
import { useRouter } from "expo-router";
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

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert("Enter your email", "Please enter the email address for your account.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/api/auth/forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      console.error("FORGOT PASSWORD ERROR:", err);
      Alert.alert("Error", "Something went wrong. Please try again.");
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
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "900" }}>
          Forgot Password
        </Text>
      </View>

      <View style={{ flex: 1, padding: 24 }}>
        {!sent ? (
          <>
            <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 16 }}>🔧</Text>
            <Text style={{ color: "white", fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 8 }}>
              Reset Your Password
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 15, textAlign: "center", marginBottom: 32, lineHeight: 22 }}>
              Enter the email address for your account and we'll send you a reset link.
            </Text>

            <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>Email Address</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor="#4b5563"
              keyboardType="email-address"
              autoCapitalize="none"
              style={{
                backgroundColor: "#11131a",
                color: "white",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: "#252838",
                fontSize: 16,
                marginBottom: 24,
              }}
            />

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={submitting || !email.trim()}
              style={{
                backgroundColor: submitting || !email.trim() ? "#1f2937" : "#345bff",
                paddingVertical: 16,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                  Send Reset Link
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 20 }}>
            <Text style={{ fontSize: 64, marginBottom: 24 }}>📧</Text>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>
              Check Your Email!
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 15, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
              If an account exists for {email}, you'll receive a password reset link shortly.
            </Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                backgroundColor: "#345bff",
                paddingVertical: 16,
                paddingHorizontal: 32,
                borderRadius: 12,
                alignItems: "center",
              }}
            >
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                Back to Login
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}