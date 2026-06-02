import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Settings() {
  const { user, logout, isMechanic, updateName, switchRole } = useAuth();
  const { themeMode, setThemeMode, colors } = useTheme();
  const router = useRouter();

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const [editingPhone, setEditingPhone] = useState(false);
  const [newPhone, setNewPhone] = useState(user?.phone || "");
  const [savingPhone, setSavingPhone] = useState(false);

  const [editingLocation, setEditingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState(user?.location || "");
  const [savingLocation, setSavingLocation] = useState(false);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopLocation, setShopLocation] = useState("");
  const [experience, setExperience] = useState("");
  const [submittingVerification, setSubmittingVerification] = useState(false);

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

  const handleSaveLocation = async () => {
    try {
      setSavingLocation(true);
      await api.put("/api/users/me", { location: newLocation.trim() });
      setEditingLocation(false);
      Alert.alert("✅ Service area updated!");
    } catch (err) {
      Alert.alert("Error", "Could not update location. Try again.");
    } finally {
      setSavingLocation(false);
    }
  };

  const handleSubmitVerification = async () => {
    if (!licenseNumber.trim() || !shopName.trim()) {
      Alert.alert("Missing fields", "License number and shop name are required.");
      return;
    }
    try {
      setSubmittingVerification(true);
      await api.post("/api/users/verification-request", { licenseNumber, shopName, shopLocation, experience });
      setShowVerifyModal(false);
      Alert.alert("✅ Request Submitted!", "We'll review your verification request within 24-48 hours.");
    } catch (err) {
      Alert.alert("Error", "Could not submit request. Try again.");
    } finally {
      setSubmittingVerification(false);
    }
  };

  const card = { backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 8, overflow: "hidden" as const };
  const row = { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, padding: 16 };
  const labelStyle = { color: colors.text, fontSize: 16 };
  const valueStyle = { color: colors.textSecondary, fontSize: 16 };
  const divider = { height: 1, backgroundColor: colors.border, marginHorizontal: 16 };
  const sectionTitle = { color: colors.textSecondary, fontSize: 13, fontWeight: "600" as const, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8, marginTop: 20 };
  const inputStyle = { backgroundColor: colors.background, color: colors.text, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.border, marginBottom: 12, fontSize: 15 };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20 }}>

      {/* VERIFICATION MODAL */}
      <Modal visible={showVerifyModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: "#00000088", justifyContent: "flex-end" }}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
              <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900", marginBottom: 4 }}>⭐ Get Verified</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 20 }}>Submit your credentials to get a verified badge on your profile.</Text>

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>License / Certification Number *</Text>
              <TextInput value={licenseNumber} onChangeText={setLicenseNumber} placeholder="e.g. ASE-12345" placeholderTextColor={colors.textMuted} style={inputStyle} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Shop / Business Name *</Text>
              <TextInput value={shopName} onChangeText={setShopName} placeholder="e.g. Mike's Auto Repair" placeholderTextColor={colors.textMuted} style={inputStyle} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Location</Text>
              <TextInput value={shopLocation} onChangeText={setShopLocation} placeholder="e.g. Newark, NJ" placeholderTextColor={colors.textMuted} style={inputStyle} />

              <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>Years of Experience</Text>
              <TextInput value={experience} onChangeText={setExperience} placeholder="e.g. 10" placeholderTextColor={colors.textMuted} keyboardType="numeric" style={inputStyle} />

              <View style={{ flexDirection: "row", gap: 10, marginTop: 8, marginBottom: 30 }}>
                <TouchableOpacity onPress={() => setShowVerifyModal(false)} style={{ flex: 1, backgroundColor: colors.border, padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSubmitVerification} disabled={submittingVerification} style={{ flex: 1, backgroundColor: colors.blue, padding: 14, borderRadius: 12, alignItems: "center" }}>
                  <Text style={{ color: "white", fontWeight: "700" }}>{submittingVerification ? "Submitting..." : "Submit"}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* HEADER */}
      <View style={{ marginTop: 20, marginBottom: 30 }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "bold" }}>⚙️ Settings</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Account preferences & app settings</Text>
      </View>

      {/* ACCOUNT SECTION */}
      <Text style={sectionTitle}>Account</Text>
      <View style={card}>
        {editingName ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 8 }}>Edit Name</Text>
            <TextInput value={newName} onChangeText={setNewName} style={{ ...inputStyle, borderColor: colors.blue }} autoFocus placeholder="Your name" placeholderTextColor={colors.textMuted} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={handleSaveName} disabled={saving} style={{ flex: 1, backgroundColor: colors.blue, padding: 12, borderRadius: 10, alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "700" }}>{saving ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setNewName(user?.name || ""); }} style={{ flex: 1, backgroundColor: colors.card, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={row} onPress={() => setEditingName(true)}>
            <Text style={labelStyle}>Name</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={valueStyle}>{user?.name || "—"}</Text>
              <Text style={{ color: colors.blue, fontSize: 13 }}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={divider} />
        <View style={row}><Text style={labelStyle}>Email</Text><Text style={valueStyle}>{user?.email || "—"}</Text></View>
        <View style={divider} />

        <View style={row}>
          <Text style={labelStyle}>Role</Text>
          {user?.id === 1 ? (
            <TouchableOpacity onPress={async () => { try { await switchRole(); } catch { Alert.alert("Error", "Could not switch role."); } }} style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: isMechanic ? "#1e3a8a" : "#064e3b", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: isMechanic ? colors.blue : colors.green }}>
              <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>{isMechanic ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>⇄ Switch</Text>
            </TouchableOpacity>
          ) : (
            <Text style={valueStyle}>{isMechanic ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
          )}
        </View>

        <View style={divider} />
        <TouchableOpacity style={row} onPress={() => router.push("/change-password")}>
          <Text style={labelStyle}>Password</Text>
          <Text style={{ color: colors.blue, fontSize: 13 }}>Change →</Text>
        </TouchableOpacity>

        {/* PHONE */}
        <View style={divider} />
        {editingPhone ? (
          <View style={{ padding: 16 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>Phone Number</Text>
            <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>Used so buyers/sellers can contact you directly.</Text>
            <TextInput value={newPhone} onChangeText={setNewPhone} style={{ ...inputStyle, borderColor: colors.blue }} autoFocus placeholder="+1 (555) 000-0000" placeholderTextColor={colors.textMuted} keyboardType="phone-pad" />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={handleSavePhone} disabled={savingPhone} style={{ flex: 1, backgroundColor: colors.blue, padding: 12, borderRadius: 10, alignItems: "center" }}>
                <Text style={{ color: "white", fontWeight: "700" }}>{savingPhone ? "Saving..." : "Save"}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingPhone(false); setNewPhone(user?.phone || ""); }} style={{ flex: 1, backgroundColor: colors.card, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={row} onPress={() => setEditingPhone(true)}>
            <Text style={labelStyle}>Phone</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={valueStyle}>{user?.phone || "Add number"}</Text>
              <Text style={{ color: colors.blue, fontSize: 13 }}>Edit</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* SERVICE AREA */}
        {isMechanic && (
          <>
            <View style={divider} />
            {editingLocation ? (
              <View style={{ padding: 16 }}>
                <Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 4 }}>Service Area</Text>
                <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 8 }}>Your city/region shown on the Near Me map.</Text>
                <TextInput value={newLocation} onChangeText={setNewLocation} style={{ ...inputStyle, borderColor: colors.blue }} autoFocus placeholder="e.g. Newark, NJ" placeholderTextColor={colors.textMuted} />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity onPress={handleSaveLocation} disabled={savingLocation} style={{ flex: 1, backgroundColor: colors.blue, padding: 12, borderRadius: 10, alignItems: "center" }}>
                    <Text style={{ color: "white", fontWeight: "700" }}>{savingLocation ? "Saving..." : "Save"}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { setEditingLocation(false); setNewLocation(user?.location || ""); }} style={{ flex: 1, backgroundColor: colors.card, padding: 12, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: colors.border }}>
                    <Text style={{ color: colors.textSecondary, fontWeight: "700" }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={row} onPress={() => setEditingLocation(true)}>
                <Text style={labelStyle}>📍 Service Area</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Text style={valueStyle}>{user?.location || "Add location"}</Text>
                  <Text style={{ color: colors.blue, fontSize: 13 }}>Edit</Text>
                </View>
              </TouchableOpacity>
            )}
          </>
        )}
      </View>

      {/* VERIFICATION SECTION */}
      {isMechanic && (
        <>
          <Text style={sectionTitle}>Verification</Text>
          <View style={card}>
            <TouchableOpacity style={row} onPress={() => setShowVerifyModal(true)}>
              <View>
                <Text style={labelStyle}>⭐ Get Verified</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>Submit credentials for a verified badge</Text>
              </View>
              <Text style={{ color: colors.blue, fontSize: 13 }}>Apply →</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* APP SECTION */}
      <Text style={sectionTitle}>App</Text>
      <View style={card}>
        <View style={row}>
          <Text style={labelStyle}>Theme</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["dark", "light", "system"] as const).map((mode) => (
              <TouchableOpacity
                key={mode}
                onPress={() => setThemeMode(mode)}
                style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: themeMode === mode ? colors.blue : colors.border, borderWidth: 1, borderColor: themeMode === mode ? colors.blue : colors.border }}
              >
                <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
                  {mode === "dark" ? "🌙 Dark" : mode === "light" ? "☀️ Light" : "📱 System"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
        <View style={divider} />
        <View style={row}><Text style={labelStyle}>Version</Text><Text style={valueStyle}>1.0.7</Text></View>
        <View style={divider} />
        <View style={row}><Text style={labelStyle}>Build</Text><Text style={valueStyle}>20</Text></View>
      </View>

      {/* FEEDBACK SECTION */}
      <Text style={sectionTitle}>Feedback</Text>
      <View style={card}>
        <TouchableOpacity style={row} onPress={() => Linking.openURL("https://apps.apple.com/app/autoai-auto-intelligence/id6764058138?action=write-review")}>
          <Text style={labelStyle}>⭐ Rate on App Store</Text>
          <Text style={{ color: colors.blue }}>Rate →</Text>
        </TouchableOpacity>
        <View style={divider} />
        <TouchableOpacity style={row} onPress={() => Linking.openURL("https://play.google.com/store/apps/details?id=app.automotiveai&showAllReviews=true")}>
          <Text style={labelStyle}>⭐ Rate on Google Play</Text>
          <Text style={{ color: colors.blue }}>Rate →</Text>
        </TouchableOpacity>
        <View style={divider} />
        <TouchableOpacity style={row} onPress={() => Linking.openURL("mailto:maz@amazmade.com?subject=AutoAI Feedback")}>
          <Text style={labelStyle}>💬 Send Feedback</Text>
          <Text style={{ color: colors.blue }}>Email →</Text>
        </TouchableOpacity>
      </View>

      {/* LEGAL SECTION */}
      <Text style={sectionTitle}>Legal</Text>
      <View style={card}>
        <TouchableOpacity style={row} onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/privacy-policy.html")}>
          <Text style={labelStyle}>Privacy Policy</Text>
          <Text style={{ color: colors.blue }}>View →</Text>
        </TouchableOpacity>
        <View style={divider} />
        <TouchableOpacity style={row} onPress={() => Linking.openURL("https://mmz1969.github.io/Automotive-Ai/terms.html")}>
          <Text style={labelStyle}>Terms of Service</Text>
          <Text style={{ color: colors.blue }}>View →</Text>
        </TouchableOpacity>
        <View style={divider} />
        <TouchableOpacity style={row} onPress={() => router.push("/guidelines")}>
          <Text style={labelStyle}>Community Guidelines</Text>
          <Text style={{ color: colors.blue }}>View →</Text>
        </TouchableOpacity>
      </View>

      {/* DELETE ACCOUNT */}
      <TouchableOpacity
        onPress={() => Alert.alert("Delete Account", "Are you sure? This will permanently delete your account and all your data. This cannot be undone.", [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: async () => { try { await api.delete("/api/auth/account"); await logout(); } catch { Alert.alert("Error", "Could not delete account. Try again."); } } },
        ])}
        style={{ backgroundColor: colors.background, padding: 16, borderRadius: 14, marginTop: 10, marginBottom: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444444" }}
      >
        <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 16 }}>🗑️ Delete Account</Text>
      </TouchableOpacity>

      {/* LOGOUT */}
      <TouchableOpacity onPress={async () => await logout()} style={{ backgroundColor: "#b91c1c", padding: 16, borderRadius: 14, marginTop: 20, marginBottom: 40, alignItems: "center" }}>
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>Log Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}
