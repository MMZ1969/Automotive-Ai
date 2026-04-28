import api from "@lib/api";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function Leaderboard() {
  const [tab, setTab] = useState<"DIYER" | "MECHANIC">("DIYER");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async (role: string) => {
    try {
      console.log("LEADERBOARD: fetching for role", role);
      const res = await api.get(`/api/users/leaderboard?role=${role}`);
      console.log("LEADERBOARD: got data", res.data);
      setUsers(res.data);
    } catch (err) {
      console.error("LEADERBOARD ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      fetchLeaderboard(tab);
    }, [tab])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeaderboard(tab);
  };

  const getRankColor = (index: number) => {
    if (index === 0) return "#fbbf24";
    if (index === 1) return "#9ca3af";
    if (index === 2) return "#f97316";
    return "#345bff";
  };

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return null;
  };

  const renderUser = (user: any, index: number) => (
    <View
      key={user.id}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: index < 3 ? "#0f1628" : "#11131a",
        borderRadius: 14,
        borderWidth: 1,
        borderColor: index === 0 ? "#fbbf2444" : index === 1 ? "#9ca3af44" : index === 2 ? "#f9731644" : "#252838",
        padding: 14,
        marginBottom: 10,
        gap: 12,
      }}
    >
      {/* RANK */}
      <Text style={{
        fontSize: index < 3 ? 24 : 16,
        fontWeight: "900",
        color: getRankColor(index),
        width: 32,
        textAlign: "center",
      }}>
        {getMedal(index) || index + 1}
      </Text>

      {/* AVATAR */}
      <View style={{
        width: index < 3 ? 52 : 44,
        height: index < 3 ? 52 : 44,
        borderRadius: index < 3 ? 26 : 22,
        backgroundColor: "#252838",
        justifyContent: "center",
        alignItems: "center",
        borderWidth: 2,
        borderColor: getRankColor(index),
        overflow: "hidden",
      }}>
        {user.profilePhoto ? (
          <Image
            source={{ uri: user.profilePhoto }}
            style={{ width: index < 3 ? 52 : 44, height: index < 3 ? 52 : 44 }}
          />
        ) : (
          <Text style={{ fontSize: index < 3 ? 22 : 18 }}>
            {user.name?.[0]?.toUpperCase() || "?"}
          </Text>
        )}
      </View>

      {/* INFO */}
      <View style={{ flex: 1 }}>
        <Text style={{
          color: "white",
          fontWeight: "700",
          fontSize: index < 3 ? 17 : 15,
        }}>
          {user.name || "Anonymous"}
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 12, marginTop: 2 }}>
          {user._count.posts} posts • {user._count.followers} followers
        </Text>
      </View>

      {/* REP */}
      <View style={{ alignItems: "flex-end" }}>
        <Text style={{
          color: getRankColor(index),
          fontWeight: "900",
          fontSize: index < 3 ? 20 : 16,
        }}>
          {user.repPoints}
        </Text>
        <Text style={{ color: "#6b7280", fontSize: 11 }}>rep</Text>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#050509" }}>
      {/* HEADER */}
      <View style={{
        paddingTop: 60,
        paddingHorizontal: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#252838",
      }}>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>
          🏆 Leaderboard
        </Text>
        <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 4 }}>
          Top earners by rep points
        </Text>
      </View>

      {/* TABS */}
      <View style={{
        flexDirection: "row",
        margin: 16,
        backgroundColor: "#11131a",
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: "#252838",
      }}>
        <TouchableOpacity
          onPress={() => setTab("DIYER")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: tab === "DIYER" ? "#345bff" : "transparent",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>🔧 DIYers</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setTab("MECHANIC")}
          style={{
            flex: 1,
            paddingVertical: 10,
            borderRadius: 10,
            alignItems: "center",
            backgroundColor: tab === "MECHANIC" ? "#345bff" : "transparent",
          }}
        >
          <Text style={{ color: "white", fontWeight: "700" }}>🏁 Mechanics</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#345bff" size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />
          }
        >
          {users.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 48 }}>🏆</Text>
              <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginTop: 16 }}>
                No users yet
              </Text>
              <Text style={{ color: "#9ca3af", marginTop: 8 }}>
                Be the first to earn rep points!
              </Text>
            </View>
          ) : (
            users.map((user, index) => renderUser(user, index))
          )}
        </ScrollView>
      )}
    </View>
  );
}