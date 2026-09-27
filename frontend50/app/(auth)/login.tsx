import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      const data = err?.response?.data;
      if (data?.needsVerification) {
        // Same destination register.tsx uses when the backend says
        // needsVerification — this is the actual bug fix: someone who
        // dismissed the code screen after registering (or never got that
        // far) has zero other way back in. Trying to log in is the one
        // thing they WILL do, so that's the hook that routes them back
        // to a verification screen instead of a dead-end error + an
        // email resend with nowhere to type the code.
        router.push({ pathname: "/(auth)/verify-email", params: { email } });
      } else {
        setError("Login failed. Check your credentials.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 }}>
      <Image
        source={require("../../assets/autoai_icon_1024_tm.png")}
        style={{ width: 200, height: 200, marginBottom: 8 }}
        resizeMode="contain"
      />
      <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 32 }}>
        Automotive Intelligence
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="email-address"
        style={{ width: "100%", backgroundColor: colors.input, color: colors.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: colors.border }}
      />

      {/* PASSWORD WITH EYE ICON */}
      <View style={{ width: "100%", flexDirection: "row", alignItems: "center", backgroundColor: colors.input, borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!showPassword}
          style={{ flex: 1, color: colors.text, paddingHorizontal: 16, paddingVertical: 12 }}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

      {/* FORGOT PASSWORD */}
      <TouchableOpacity onPress={() => router.push("/forgot-password")} style={{ alignSelf: "flex-end", marginBottom: 16 }}>
        <Text style={{ color: colors.blue, fontSize: 13 }}>Forgot Password?</Text>
      </TouchableOpacity>

      {/* ERROR */}
      {error && (
        <Text style={{ color: "#ef4444", marginBottom: 12, textAlign: "center" }}>{error}</Text>
      )}

      <TouchableOpacity
        onPress={handleLogin}
        disabled={submitting}
        style={{ width: "100%", backgroundColor: submitting ? colors.card : colors.blue, paddingVertical: 16, borderRadius: 12, alignItems: "center", marginBottom: 16 }}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>Login</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
        <Text style={{ color: colors.blue, fontSize: 15 }}>Don't have an account? Sign Up</Text>
      </TouchableOpacity>
    </View>
  );
}
