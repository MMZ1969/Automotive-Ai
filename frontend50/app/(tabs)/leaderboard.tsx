import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Image, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Leaderboard() {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<"DIYER" | "MECHANIC">("DIYER");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedUserId, setExpandedUserId] = useState<number | null>(null);

  const fetchLeaderboard = async (role: string) => {
    try {
      const res = await api.get(`/api/users/leaderboard?role=${role}`);
      setUsers(res.data);
    } catch (err) { console.error("LEADERBOARD ERROR:", err); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { setLoading(true); fetchLeaderboard(tab); }, [tab]));
  const onRefresh = () => { setRefreshing(true); fetchLeaderboard(tab); };
  const filteredUsers = search.trim()
  ? users.filter(u => u.name?.toLowerCase().includes(search.toLowerCase()))
  : users;

  const getRankColor = (index: number) => {
    if (index === 0) return "#fbbf24";
    if (index === 1) return "#9ca3af";
    if (index === 2) return "#f97316";
    return colors.blue;
  };

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return null;
  };

  const renderUser = (user: any, index: number) => {
    const isExpanded = expandedUserId === user.id;
    const breakdown = user.repBreakdown || [];

    return (
    <View key={user.id} style={{ marginBottom: 10 }}>
      <TouchableOpacity
        onPress={() => setExpandedUserId(isExpanded ? null : user.id)}
        onLongPress={() => router.push({ pathname: "/(tabs)/user/[id]", params: { id: user.id, from: "leaderboard" } })}
        style={{
          flexDirection: "row", alignItems: "center",
          backgroundColor: index < 3 ? colors.background : colors.card,
          borderRadius: 14, borderWidth: 1,
          borderColor: isExpanded ? colors.blue : index === 0 ? "#fbbf2444" : index === 1 ? "#9ca3af44" : index === 2 ? "#f9731644" : colors.border,
          padding: 14, gap: 12,
        }}>
        <Text style={{ fontSize: index < 3 ? 24 : 16, fontWeight: "900", color: getRankColor(index), width: 32, textAlign: "center" }}>
          {getMedal(index) || index + 1}
        </Text>
        <View style={{ width: index < 3 ? 52 : 44, height: index < 3 ? 52 : 44, borderRadius: index < 3 ? 26 : 22, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: getRankColor(index), overflow: "hidden" }}>
          {user.profilePhoto ? (
            <Image source={{ uri: user.profilePhoto }} style={{ width: index < 3 ? 52 : 44, height: index < 3 ? 52 : 44 }} />
          ) : (
            <Text style={{ fontSize: index < 3 ? 22 : 18 }}>{user.name?.[0]?.toUpperCase() || "?"}</Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: index < 3 ? 17 : 15 }}>{user.name || "Anonymous"}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>{user._count.posts} posts • {user._count.followers} followers</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ color: getRankColor(index), fontWeight: "900", fontSize: index < 3 ? 20 : 16 }}>{user.repPoints}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 11 }}>rep</Text>
        </View>
        <Text style={{ color: colors.textMuted, fontSize: 16, marginLeft: 4 }}>{isExpanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {isExpanded && (
        <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.blue + "33", borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: 14, marginTop: -1 }}>
          <Text style={{ color: colors.textMuted, fontSize: 11, marginBottom: 10, fontStyle: "italic" }}>
            How {user.name || "this user"} earned {user.repPoints} rep
          </Text>
          {breakdown.length === 0 ? (
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>No rep-earning activity yet.</Text>
          ) : (
            breakdown.map((item: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: i < breakdown.length - 1 ? 8 : 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Text style={{ fontSize: 15 }}>{item.icon}</Text>
                  <Text style={{ color: colors.text, fontSize: 13 }}>{item.label}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>({item.count})</Text>
                </View>
                <Text style={{ color: colors.blue, fontWeight: "700", fontSize: 13 }}>+{item.rep}</Text>
              </View>
            ))
          )}
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/(tabs)/user/[id]", params: { id: user.id, from: "leaderboard" } })}
            style={{ marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}
          >
            <Text style={{ color: colors.blue, fontSize: 12, fontWeight: "700", textAlign: "center" }}>View Full Profile →</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginBottom: 12 }}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>🏆 Leaderboard</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 4 }}>Top earners by rep points • tap a row to see how</Text>
      </View>

      <View style={{ flexDirection: "row", margin: 16, backgroundColor: colors.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: colors.border }}>
        <TouchableOpacity onPress={() => setTab("DIYER")} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: tab === "DIYER" ? colors.blue : "transparent" }}>
          <Text style={{ color: tab === "DIYER" ? "white" : colors.textMuted, fontWeight: "700" }}>🔧 DIYers</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTab("MECHANIC")} style={{ flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center", backgroundColor: tab === "MECHANIC" ? colors.blue : "transparent" }}>
          <Text style={{ color: tab === "MECHANIC" ? "white" : colors.textMuted, fontWeight: "700" }}>🏁 Mechanics</Text>
        </TouchableOpacity>
      </View>
      <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search users..."
          placeholderTextColor={colors.textMuted}
          style={{ backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 15 }}
        />
        </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}>
          {users.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>🏆</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>No users yet</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Be the first to earn rep points!</Text>
            </View>
          ) : (
            filteredUsers.map((user, index) => renderUser(user, index))
          )}
        </ScrollView>
      )}
    </View>
  );
}
