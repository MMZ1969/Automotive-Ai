import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function FollowersList() {
  const { id, type } = useLocalSearchParams();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get(`/api/users/${id}/${type}`);
      setUsers(res.data);
    } catch (err) {
      console.error("FETCH FOLLOWERS ERROR:", err);
    } finally {
      setLoading(false);
    }
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
          {type === "followers" ? "Followers" : "Following"}
        </Text>
      </View>

      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 36 }}>👥</Text>
            <Text style={{ color: "#9ca3af", marginTop: 12, fontSize: 15 }}>
              {type === "followers" ? "No followers yet" : "Not following anyone yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/user/${item.id}`)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#11131a",
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 14,
              marginBottom: 10,
              gap: 12,
            }}
          >
            <View style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: "#252838",
              justifyContent: "center",
              alignItems: "center",
              borderWidth: 2,
              borderColor: item.role === "MECHANIC" ? "#345bff" : "#10b981",
              overflow: "hidden",
            }}>
              {item.profilePhoto ? (
                <Image source={{ uri: item.profilePhoto }} style={{ width: 48, height: 48, borderRadius: 24 }} />
              ) : (
                <Text style={{ color: "white", fontSize: 20, fontWeight: "700" }}>
                  {item.name?.[0]?.toUpperCase() || "?"}
                </Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                {item.name}
              </Text>
              <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
                {item.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
              </Text>
            </View>
            <Text style={{ color: "#345bff", fontSize: 13 }}>View →</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}