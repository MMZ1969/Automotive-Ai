import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Settings() {
  const { user, logout, isMechanic, updateName, switchRole } = useAuth();
  const router = useRouter();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phone || "");
  const [savingPhone, setSavingPhone] = useState(false);

  const handleSaveName = async () => {
    if (!newName.trim()) return;
    try {
      setSaving(true);
      await updateName(newName.trim());
      setEditingName(false);
      Alert.alert("✅ Name updated!");
    } catch (err) {
      Alert.alert("Error", "Could not update name. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSavePhone = async () => {
    try {
      setSavingPhone(true);
      await api.put("/api/users/me", { phone: newPhone.trim() });
      setEditingPhone(false);
      Alert.alert("✅ Phone number updated!");
    } catch (err) {
      Alert.alert("Error", "Could not update phone number. Try again.");
    } finally {
      setSavingPhone(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#050509" }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* HEADER */}
      <View style={{ marginTop: 20, marginBottom: 30 }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "bold" }}>
          ⚙️ Settings
        </Text>
        <Text style={{ color: "#9ca3af", marginTop: 4 }}>
          Account preferences & app settings
        </Text>
      </View>

      {/* ACCOUNT SECTION */}
      <Text style={sectionTitle}>Account</Text>

      <View style={card}>
        {/* NAME ROW */}
        {editingName ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 8 }}>
              Edit Name
            </Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              style={{
                backgroundColor: "#050509",
                color: "white",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#345bff",
                fontSize: 16,
                marginBottom: 12,
              }}
              autoFocus
              placeholder="Your name"
              placeholderTextColor="#4b5563"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={handleSaveName}
                disabled={saving}
                style={{
                  flex: 1,
                  backgroundColor: "#345bff",
                  padding: 12,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {saving ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setEditingName(false);
                  setNewName(user?.name || "");
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#11131a",
                  padding: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#252838",
                }}
              >
                <Text style={{ color: "#9ca3af", fontWeight: "700" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={row} onPress={() => setEditingName(true)}>
            <Text style={label}>Name</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={value}>{user?.name || "—"}</Text>
              <Text style={{ color: "#345bff", fontSize: 13 }}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={divider} />
        <View style={row}>
          <Text style={label}>Email</Text>
          <Text style={value}>{user?.email || "—"}</Text>
        </View>
        <View style={divider} />
<View style={row}>
  <Text style={label}>Role</Text>
  {user?.id === 1 ? (
    <TouchableOpacity
      onPress={async () => {
        try {
          await switchRole();
        } catch (err) {
          Alert.alert("Error", "Could not switch role. Try again.");
        }
      }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: isMechanic ? "#1e3a8a" : "#064e3b",
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: isMechanic ? "#345bff" : "#10b981",
      }}
    >
      <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
        {isMechanic ? "🏁 Mechanic" : "🔧 DIYer"}
      </Text>
      <Text style={{ color: "#9ca3af", fontSize: 11 }}>⇄ Switch</Text>
    </TouchableOpacity>
         ) : (
    <Text style={value}>{isMechanic ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
  )}
        </View>
        <View style={divider} />
        <TouchableOpacity style={row} onPress={() => router.push("/change-password")}>
          <Text style={label}>Password</Text>
          <Text style={{ color: "#345bff", fontSize: 13 }}>Change →</Text>
        </TouchableOpacity>
        
        {/* PHONE ROW */}
        <View style={divider} />
        {editingPhone ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginBottom: 4 }}>
              Phone Number
            </Text>
            <Text style={{ color: "#6b7280", fontSize: 11, marginBottom: 8 }}>
              Used so buyers/sellers can contact you directly.
            </Text>
            <TextInput
              value={newPhone}
              onChangeText={setNewPhone}
              style={{
                backgroundColor: "#050509",
                color: "white",
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "#345bff",
                fontSize: 16,
                marginBottom: 12,
              }}
              autoFocus
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#4b5563"
              keyboardType="phone-pad"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={handleSavePhone}
                disabled={savingPhone}
                style={{
                  flex: 1,
                  backgroundColor: "#345bff",
                  padding: 12,
                  borderRadius: 10,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>
                  {savingPhone ? "Saving..." : "Save"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setEditingPhone(false);
                  setNewPhone(user?.phone || "");
                }}
                style={{
                  flex: 1,
                  backgroundColor: "#11131a",
                  padding: 12,
                  borderRadius: 10,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: "#252838",
                }}
              >
                <Text style={{ color: "#9ca3af", fontWeight: "700" }}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={row} onPress={() => setEditingPhone(true)}>
            <Text style={label}>Phone</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={value}>{user?.phone || "Add number"}</Text>
              <Text style={{ color: "#345bff", fontSize: 13 }}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* APP SECTION */}
      <Text style={sectionTitle}>App</Text>

      <View style={card}>
        <View style={row}>
          <Text style={label}>Version</Text>
          <Text style={value}>1.0.3</Text>
        </View>
        <View style={divider} />
        <View style={row}>
          <Text style={label}>Build</Text>
          <Text style={value}>16</Text>
        </View>
      </View>

      {/* RATE US SECTION */}
<Text style={sectionTitle}>Feedback</Text>

<View style={card}>
  <TouchableOpacity
    style={row}
    onPress={() => Linking.openURL("https://apps.apple.com/app/autoai-auto-intelligence/id6764058138?action=write-review")}
  >
    <Text style={label}>⭐ Rate on App Store</Text>
    <Text style={{ color: "#345bff" }}>Rate →</Text>
  </TouchableOpacity>
  <View style={divider} />
  <TouchableOpacity
    style={row}
    onPress={() => Linking.openURL("https://play.google.com/store/apps/details?id=app.automotiveai&showAllReviews=true")}
  >
    <Text style={label}>⭐ Rate on Google Play</Text>
    <Text style={{ color: "#345bff" }}>Rate →</Text>
  </TouchableOpacity>
  <View style={divider} />
  <TouchableOpacity
    style={row}
    onPress={() => Linking.openURL("mailto:maz@amazmade.com?subject=AutoAI Feedback")}
  >
    <Text style={label}>💬 Send Feedback</Text>
    <Text style={{ color: "#345bff" }}>Email →</Text>
  </TouchableOpacity>
</View>

      {/* LEGAL SECTION */}
      <Text style={sectionTitle}>Legal</Text>

      <View style={card}>
        <TouchableOpacity
          style={row}
          onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/privacy-policy.html")}
        >
          <Text style={label}>Privacy Policy</Text>
          <Text style={{ color: "#345bff" }}>View →</Text>
        </TouchableOpacity>
        <View style={divider} />
        <TouchableOpacity
          style={row}
          onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/terms.html")}
        >
          <Text style={label}>Terms of Service</Text>
          <Text style={{ color: "#345bff" }}>View →</Text>
        </TouchableOpacity>
        <View style={divider} />
        <TouchableOpacity
          style={row}
          onPress={() => router.push("/guidelines")}
        >
          <Text style={label}>Community Guidelines</Text>
          <Text style={{ color: "#345bff" }}>View →</Text>
        </TouchableOpacity>
      </View>

      {/* DELETE ACCOUNT */}
      <TouchableOpacity
        onPress={() => {
          Alert.alert(
            "Delete Account",
            "Are you sure? This will permanently delete your account and all your data. This cannot be undone.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                  try {
                    await api.delete("/api/auth/account");
                    await logout();
                  } catch (err) {
                    Alert.alert("Error", "Could not delete account. Try again.");
                  }
                },
              },
            ]
          );
        }}
        style={{
          backgroundColor: "#0a0a0a",
          padding: 16,
          borderRadius: 14,
          marginTop: 10,
          marginBottom: 10,
          alignItems: "center",
          borderWidth: 1,
          borderColor: "#ef444444",
        }}
      >
        <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 16 }}>
          🗑️ Delete Account
        </Text>
      </TouchableOpacity>

      {/* LOGOUT */}
      <TouchableOpacity
        onPress={async () => await logout()}
        style={{
          backgroundColor: "#b91c1c",
          padding: 16,
          borderRadius: 14,
          marginTop: 20,
          marginBottom: 40,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
          Log Out
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const sectionTitle = {
  color: "#9ca3af",
  fontSize: 13,
  fontWeight: "600" as const,
  letterSpacing: 1,
  textTransform: "uppercase" as const,
  marginBottom: 8,
  marginTop: 20,
};

const card = {
  backgroundColor: "#11131a",
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 8,
  overflow: "hidden" as const,
};

const row = {
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  padding: 16,
};

const label = {
  color: "#f5f5f5",
  fontSize: 16,
};

const value = {
  color: "#9ca3af",
  fontSize: 16,
};

const divider = {
  height: 1,
  backgroundColor: "#252838",
  marginHorizontal: 16,
};
