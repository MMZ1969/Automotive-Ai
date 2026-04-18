import { useAuth } from "@context/AuthContext";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Register() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"DIYER" | "MECHANIC">("DIYER");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!name || !email || !password) {
      Alert.alert("Missing fields", "All fields are required.");
      return;
    }

    try {
      setLoading(true);
      await register({ name, email, password, role });
      // Let (auth)/index handle role-based redirect automatically
    } catch (err: any) {
      Alert.alert("Registration failed", err.message || "Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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

      <TextInput
        placeholder="Password"
        placeholderTextColor="#888"
        secureTextEntry
        style={styles.input}
        value={password}
        onChangeText={setPassword}
      />

      {/* Role Picker */}
      <Text style={styles.roleLabel}>I am a...</Text>
      <View style={styles.roleContainer}>
        <TouchableOpacity
          onPress={() => setRole("DIYER")}
          style={[
            styles.roleButton,
            role === "DIYER" && styles.roleButtonActiveDIYER,
          ]}
        >
          <Text style={styles.roleIcon}>🔧</Text>
          <Text style={styles.roleText}>DIYer</Text>
          <Text style={styles.roleSubtext}>I work on my own car</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => setRole("MECHANIC")}
          style={[
            styles.roleButton,
            role === "MECHANIC" && styles.roleButtonActiveMECHANIC,
          ]}
        >
          <Text style={styles.roleIcon}>🏁</Text>
          <Text style={styles.roleText}>Mechanic</Text>
          <Text style={styles.roleSubtext}>I work on others' cars</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={loading}
      >
        <Text style={styles.buttonText}>
          {loading ? "Creating account..." : "Sign Up"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
        <Text style={styles.link}>Already have an account? Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#050509",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "white",
    marginBottom: 24,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#11131a",
    color: "white",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#252838",
  },
  roleLabel: {
    color: "#9ca3af",
    fontSize: 14,
    marginBottom: 10,
    marginTop: 4,
  },
  roleContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "#11131a",
    borderWidth: 1,
    borderColor: "#252838",
  },
  roleButtonActiveDIYER: {
    backgroundColor: "#064e3b",
    borderColor: "#10b981",
  },
  roleButtonActiveMECHANIC: {
    backgroundColor: "#1e3a8a",
    borderColor: "#345bff",
  },
  roleIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  roleText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  roleSubtext: {
    color: "#9ca3af",
    fontSize: 11,
    marginTop: 3,
    textAlign: "center",
  },
  button: {
    backgroundColor: "#345bff",
    padding: 16,
    borderRadius: 12,
    marginTop: 4,
  },
  buttonDisabled: {
    backgroundColor: "#1f2937",
  },
  buttonText: {
    color: "white",
    textAlign: "center",
    fontWeight: "bold",
    fontSize: 16,
  },
  link: {
    color: "#3b82f6",
    textAlign: "center",
    marginTop: 16,
    fontSize: 16,
  },
});