import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"DIYER" | "MECHANIC">("DIYER");
  const [loading, setLoading] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [resending, setResending] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Missing fields", "All fields are required.");
      return;
    }
    if (!agreedToTerms) {
      Alert.alert("Terms Required", "You must agree to the Terms of Service and Community Guidelines to create an account.");
      return;
    }
    if (password.length < 8) {
  Alert.alert("Weak Password", "Password must be at least 8 characters.");
      return;
    }
    if (!/[0-9]/.test(password)) {
      Alert.alert("Weak Password", "Password must contain at least one number.");
      return;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      Alert.alert("Weak Password", "Password must contain at least one special character (!@#$%^&* etc).");
      return;
    }
    try {
      setLoading(true);
      await register({ name, email, password, role });
    } catch (err: any) {
      // If needsVerification is true, show the verification screen
      if (err?.needsVerification) {
        setRegisteredEmail(email);
        setNeedsVerification(true);
      } else {
        Alert.alert("Registration failed", err.message || "Try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      setResending(true);
      await api.post("/api/auth/resend-verification", { email: registeredEmail });
      Alert.alert("✅ Sent!", "Check your inbox for a new verification link.");
    } catch (err) {
      Alert.alert("Error", "Could not resend. Try again.");
    } finally {
      setResending(false);
    }
  };

  // VERIFICATION PENDING SCREEN
  if (needsVerification) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center", padding: 30 }}>
        <Text style={{ fontSize: 60, marginBottom: 20 }}>📧</Text>
        <Text style={{ color: "white", fontSize: 24, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>
          Check Your Email
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 15, textAlign: "center", lineHeight: 24, marginBottom: 8 }}>
          We sent a verification link to:
        </Text>
        <Text style={{ color: "#345bff", fontSize: 15, fontWeight: "700", textAlign: "center", marginBottom: 24 }}>
          {registeredEmail}
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", lineHeight: 22, marginBottom: 32 }}>
          Tap the link in the email to activate your account. Check your spam folder if you don't see it.
        </Text>

        <TouchableOpacity
          onPress={handleResend}
          disabled={resending}
          style={{ backgroundColor: "#11131a", borderWidth: 1, borderColor: "#345bff", padding: 14, borderRadius: 12, width: "100%", alignItems: "center", marginBottom: 12 }}
        >
          <Text style={{ color: "#345bff", fontWeight: "700", fontSize: 15 }}>
            {resending ? "Sending..." : "Resend Verification Email"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
          <Text style={{ color: "#6b7280", fontSize: 14, marginTop: 8 }}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#050509" }}
      contentContainerStyle={{ padding: 20, justifyContent: "center", flexGrow: 1 }}
    >
      <Text style={styles.title}>Create Account</Text>

      <TextInput
        placeholder="Name"
        placeholderTextColor="#888"
        style={styles.input}
        value={name}
        onChangeText={setName}
      />

      <TextInput
        placeholder="Email"
        placeholderTextColor="#888"
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      {/* PASSWORD WITH EYE ICON */}
      <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#11131a", borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: "#252838" }}>
        <TextInput
          placeholder="Password"
          placeholderTextColor="#888"
          secureTextEntry={!showPassword}
          style={{ flex: 1, color: "white", padding: 12 }}
          value={password}
          onChangeText={setPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingHorizontal: 14 }}>
          <Text style={{ fontSize: 18 }}>{showPassword ? "🙈" : "👁️"}</Text>
        </TouchableOpacity>
      </View>

      {/* Role Picker */}
      <Text style={styles.roleLabel}>I am a...</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity onPress={() => setRole("DIYER")} style={[styles.roleButton, role === "DIYER" && styles.roleButtonActiveDIYER]}>
          <Text style={styles.roleIcon}>🔧</Text>
          <Text style={styles.roleText}>DIYer</Text>
          <Text style={styles.roleSubtext}>I work on my own car</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setRole("MECHANIC")} style={[styles.roleButton, role === "MECHANIC" && styles.roleButtonActiveMECHANIC]}>
          <Text style={styles.roleIcon}>🏁</Text>
          <Text style={styles.roleText}>Mechanic</Text>
          <Text style={styles.roleSubtext}>I work on others' cars</Text>
        </TouchableOpacity>
      </View>

      {/* TERMS AGREEMENT */}
      <TouchableOpacity onPress={() => setAgreedToTerms(!agreedToTerms)} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 20, gap: 12 }}>
        <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: agreedToTerms ? "#345bff" : "#252838", backgroundColor: agreedToTerms ? "#345bff" : "transparent", justifyContent: "center", alignItems: "center", marginTop: 2 }}>
          {agreedToTerms && <Text style={{ color: "white", fontSize: 14, fontWeight: "700" }}>✓</Text>}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: "#9ca3af", fontSize: 13, lineHeight: 20 }}>
            I agree to the{" "}
            <Text style={{ color: "#345bff", textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/terms.html")}>
              Terms of Service
            </Text>
            {" "}and{" "}
            <Text style={{ color: "#345bff", textDecorationLine: "underline" }} onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/privacy-policy.html")}>
              Privacy Policy
            </Text>
            . I understand there is zero tolerance for objectionable content or abusive behavior.
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.button, (loading || !agreedToTerms) && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading || !agreedToTerms}
      >
        <Text style={styles.buttonText}>{loading ? "Creating account..." : "Sign Up"}</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 32, fontWeight: "bold", color: "white", marginBottom: 24, textAlign: "center" },
  input: { backgroundColor: "#11131a", color: "white", padding: 12, borderRadius: 8, marginBottom: 12, borderWidth: 1, borderColor: "#252838" },
  roleLabel: { color: "#9ca3af", fontSize: 14, marginBottom: 10, marginTop: 4 },
  roleContainer: { flexDirection: "row", gap: 10, marginBottom: 20 },
  roleButton: { flex: 1, padding: 14, borderRadius: 10, alignItems: "center", backgroundColor: "#11131a", borderWidth: 1, borderColor: "#252838" },
  roleButtonActiveDIYER: { backgroundColor: "#064e3b", borderColor: "#10b981" },
  roleButtonActiveMECHANIC: { backgroundColor: "#1e3a8a", borderColor: "#345bff" },
  roleIcon: { fontSize: 28, marginBottom: 6 },
  roleText: { color: "white", fontWeight: "bold", fontSize: 16 },
  roleSubtext: { color: "#9ca3af", fontSize: 11, marginTop: 3, textAlign: "center" },
  button: { backgroundColor: "#345bff", padding: 16, borderRadius: 12, marginTop: 4 },
  buttonDisabled: { backgroundColor: "#1f2937" },
  buttonText: { color: "white", textAlign: "center", fontWeight: "bold", fontSize: 16 },
  link: { color: "#3b82f6", textAlign: "center", marginTop: 16, fontSize: 16 },
});
