import { useAuth } from "@context/AuthContext";
import React, { useState } from "react";
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function LoginScreen() {
  const { login } = useAuth();

  const [email, setEmail] = useState("Mz@gmail.com");
  const [password, setPassword] = useState("password"); // adjust as needed
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    setSubmitting(true);

    try {
      console.log("LOGIN SCREEN: calling AuthContext.login");
      await login(email, password);
      console.log("LOGIN SCREEN: login resolved, navigation handled by tabs/auth logic");
      // Do NOT manually navigate here – (auth)/index + (tabs)/_layout handle it
    } catch (err: any) {
      console.error("LOGIN SCREEN ERROR:", err?.response?.data || err?.message || err);
      setError("Login failed. Check your credentials.");
    } finally {
      setSubmitting(false);
    }
  };

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
      <Text style={{ color: "white", fontSize: 32, fontWeight: "900", marginBottom: 24 }}>
        Login
      </Text>

      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
        style={{
          width: "100%",
          backgroundColor: "#11131a",
          color: "white",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: "#252838",
        }}
      />

      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        placeholderTextColor="#6b7280"
        secureTextEntry
        style={{
          width: "100%",
          backgroundColor: "#11131a",
          color: "white",
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 10,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: "#252838",
        }}
      />

      {error && (
        <Text style={{ color: "#f87171", marginBottom: 12, textAlign: "center" }}>
          {error}
        </Text>
      )}

      <TouchableOpacity
        onPress={handleLogin}
        disabled={submitting}
        style={{
          width: "100%",
          backgroundColor: submitting ? "#1f2937" : "#345bff",
          paddingVertical: 16,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>Login</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}