import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function AdminPanel() {
  const router = useRouter();
  const { colors } = useTheme();
  const [view, setView] = useState<"verify" | "users">("verify");
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await api.get("/api/users/verification-requests");
      setRequests(res.data);
    } catch (err) {
      console.error("FETCH REQUESTS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/api/users/admin/all");
      setUsers(res.data);
    } catch (err) {
      console.error("FETCH USERS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchData = async () => {
    if (view === "verify") await fetchRequests();
    else await fetchUsers();
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchData(); }, [view]));
  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const handleVerify = async (userId: number, name: string, approved: boolean) => {
    Alert.alert(
      approved ? "✅ Approve Verification" : "❌ Deny Verification",
      approved
        ? `Grant ${name} the Verified Mechanic badge?`
        : `Deny ${name}'s verification request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: approved ? "Approve" : "Deny",
          style: approved ? "default" : "destructive",
          onPress: async () => {
            try {
              await api.post(`/api/users/${userId}/verify`, { approved });
              fetchRequests();
              Alert.alert(
                approved ? "✅ Verified!" : "❌ Denied",
                approved
                  ? `${name} is now a Verified Mechanic!`
                  : `${name}'s request has been denied.`
              );
            } catch (err) {
              Alert.alert("Error", "Could not process request. Try again.");
            }
          },
        },
      ]
    );
  };

  const handleToggleBan = (target: any) => {
    const action = target.isBanned ? "Unban" : "Ban";
    Alert.alert(`${action} User`, `${action} ${target.name} (${target.email})?`, [
      { text: "Cancel", style: "cancel" },
      { text: action, style: "destructive", onPress: async () => {
        try {
          const res = await api.post(`/api/users/${target.id}/ban`);
          setUsers(prev => prev.map(u => u.id === target.id ? { ...u, isBanned: res.data.isBanned } : u));
        } catch (err) {
          console.error("BAN USER ERROR:", err);
          Alert.alert("Error", "Could not update ban status.");
        }
      }},
    ]);
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>🛡️ Admin Panel</Text>
        </View>

        {/* TAB TOGGLE */}
        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 4 }}>
          <TouchableOpacity onPress={() => setView("verify")} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: view === "verify" ? colors.blue : "transparent" }}>
            <Text style={{ color: view === "verify" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>
              ✅ Verification ({requests.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setView("users")} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: view === "users" ? colors.blue : "transparent" }}>
            <Text style={{ color: view === "users" ? "white" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>
              👥 Users
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VERIFICATION REQUESTS VIEW */}
      {view === "verify" && (
        <FlatList
          data={requests}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>✅</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>All clear!</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>No pending verification requests</Text>
            </View>
          }
          renderItem={({ item }) => {
            const details = item.verificationRequest ? JSON.parse(item.verificationRequest) : {};
            return (
              <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 14 }}>
                {/* USER INFO */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, borderWidth: 2, borderColor: colors.blue, justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                    {item.profilePhoto ? (
                      <Image source={{ uri: item.profilePhoto }} style={{ width: 48, height: 48 }} />
                    ) : (
                      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{item.name?.[0]?.toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.email}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>⭐ {item.repPoints} rep</Text>
                  </View>
                </View>

                {/* VERIFICATION DETAILS */}
                <View style={{ backgroundColor: colors.background, borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: colors.border }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>License / Cert</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.licenseNumber || "—"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Shop Name</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.shopName || "—"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Location</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.shopLocation || "—"}</Text>
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Experience</Text>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600" }}>{details.experience ? `${details.experience} years` : "—"}</Text>
                  </View>
                </View>

                {/* APPROVE / DENY BUTTONS */}
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleVerify(item.id, item.name, true)}
                    style={{ flex: 1, backgroundColor: colors.green, padding: 13, borderRadius: 10, alignItems: "center" }}
                  >
                    <Text style={{ color: "white", fontWeight: "700" }}>✅ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleVerify(item.id, item.name, false)}
                    style={{ flex: 1, backgroundColor: colors.card, padding: 13, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444444" }}
                  >
                    <Text style={{ color: "#ef4444", fontWeight: "700" }}>❌ Deny</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* USERS VIEW */}
      {view === "users" && (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={{
              backgroundColor: colors.card, borderRadius: 14, borderWidth: 1,
              borderColor: item.isBanned ? "#ef4444" : colors.border,
              padding: 14, marginBottom: 10,
            }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{item.name || "Unnamed"}</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{item.email}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>{item.role}</Text>
                  {item.isVerified && <Text style={{ color: "#f59e0b", fontSize: 11, marginTop: 2 }}>🏁 Verified</Text>}
                  {item.isAdmin && <Text style={{ color: colors.blue, fontSize: 11, marginTop: 2 }}>👑 Admin</Text>}
                </View>
              </View>
              {item.isBanned && (
                <View style={{ backgroundColor: "#ef444422", borderRadius: 8, padding: 6, marginBottom: 8, alignItems: "center" }}>
                  <Text style={{ color: "#ef4444", fontSize: 12, fontWeight: "700" }}>🚫 BANNED</Text>
                </View>
              )}
              {!item.isAdmin && (
                <TouchableOpacity
                  onPress={() => handleToggleBan(item)}
                  style={{
                    backgroundColor: item.isBanned ? colors.green : "#ef4444",
                    padding: 10, borderRadius: 10, alignItems: "center",
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>
                    {item.isBanned ? "✅ Unban User" : "🚫 Ban User"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}