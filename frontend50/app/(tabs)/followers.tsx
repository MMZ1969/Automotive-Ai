import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Image, Text, TouchableOpacity, View } from "react-native";

export default function FollowersList() {
  const { id, type } = useLocalSearchParams();
  const { colors } = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { fetchUsers(); }, [id, type]));

  const fetchUsers = async () => {
    try {
    const res = await api.get(`/api/users/${id}/${type}`);
    setUsers(res.data);
    } catch (err) { console.error("FETCH FOLLOWERS ERROR:", err); }
    finally { setLoading(false); }
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
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/(profile)")}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>
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
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontSize: 15 }}>
              {type === "followers" ? "No followers yet" : "Not following anyone yet"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${item.id}`)}
            style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10, gap: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: item.role === "MECHANIC" ? colors.blue : colors.green, overflow: "hidden" }}>
              {item.profilePhoto ? (
                <Image source={{ uri: item.profilePhoto }} style={{ width: 48, height: 48, borderRadius: 24 }} />
              ) : (
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{item.name?.[0]?.toUpperCase() || "?"}</Text>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{item.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>{item.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
            </View>
            <Text style={{ color: colors.blue, fontSize: 13 }}>View →</Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
