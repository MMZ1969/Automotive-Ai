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
  const [requests, setRequests] = useState<any[]>([]);
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

  useFocusEffect(useCallback(() => { fetchRequests(); }, []));
  const onRefresh = () => { setRefreshing(true); fetchRequests(); };

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

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>
      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#252838" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
          </TouchableOpacity>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>🛡️ Admin Panel</Text>
        </View>
      </View>

      {/* VERIFICATION REQUESTS */}
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "600", letterSpacing: 1, textTransform: "uppercase" }}>
          Verification Requests ({requests.length})
        </Text>
      </View>

      <FlatList
        data={requests}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginTop: 16 }}>All clear!</Text>
            <Text style={{ color: "#9ca3af", marginTop: 8 }}>No pending verification requests</Text>
          </View>
        }
        renderItem={({ item }) => {
          const details = item.verificationRequest ? JSON.parse(item.verificationRequest) : {};
          return (
            <View style={{ backgroundColor: "#11131a", borderRadius: 16, borderWidth: 1, borderColor: "#252838", padding: 16, marginBottom: 14 }}>
              {/* USER INFO */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#252838", borderWidth: 2, borderColor: "#345bff", justifyContent: "center", alignItems: "center", overflow: "hidden" }}>
                  {item.profilePhoto ? (
                    <Image source={{ uri: item.profilePhoto }} style={{ width: 48, height: 48 }} />
                  ) : (
                    <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>{item.name?.[0]?.toUpperCase()}</Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>{item.name}</Text>
                  <Text style={{ color: "#9ca3af", fontSize: 13 }}>{item.email}</Text>
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>⭐ {item.repPoints} rep</Text>
                </View>
              </View>

              {/* VERIFICATION DETAILS */}
              <View style={{ backgroundColor: "#050509", borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#252838" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>License / Cert</Text>
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{details.licenseNumber || "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>Shop Name</Text>
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{details.shopName || "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>Location</Text>
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{details.shopLocation || "—"}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: "#9ca3af", fontSize: 12 }}>Experience</Text>
                  <Text style={{ color: "white", fontSize: 12, fontWeight: "600" }}>{details.experience ? `${details.experience} years` : "—"}</Text>
                </View>
              </View>

              {/* APPROVE / DENY BUTTONS */}
              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity
                  onPress={() => handleVerify(item.id, item.name, true)}
                  style={{ flex: 1, backgroundColor: "#10b981", padding: 13, borderRadius: 10, alignItems: "center" }}
                >
                  <Text style={{ color: "white", fontWeight: "700" }}>✅ Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleVerify(item.id, item.name, false)}
                  style={{ flex: 1, backgroundColor: "#1a0a0a", padding: 13, borderRadius: 10, alignItems: "center", borderWidth: 1, borderColor: "#ef444444" }}
                >
                  <Text style={{ color: "#ef4444", fontWeight: "700" }}>❌ Deny</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}
