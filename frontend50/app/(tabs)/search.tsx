import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Search() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [following, setFollowing] = useState<Record<number, boolean>>({});

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    try {
      setLoading(true);
      const res = await api.get(`/api/users/search?q=${text}`);
      setResults(res.data);
      setSearched(true);

      // Check follow status for each result
      const followStatuses: Record<number, boolean> = {};
      await Promise.all(
        res.data.map(async (u: any) => {
          try {
            const fr = await api.get(`/api/users/${u.id}/follow-status`);
            followStatuses[u.id] = fr.data.following;
          } catch {
            followStatuses[u.id] = false;
          }
        })
      );
      setFollowing(followStatuses);
    } catch (err) {
      console.error("SEARCH ERROR:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/api/users/${userId}/follow`);
      setFollowing((prev) => ({ ...prev, [userId]: !prev[userId] }));
    } catch (err) {
      console.error("FOLLOW ERROR:", err);
    }
  };

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
        <Text style={{ color: "white", fontSize: 28, fontWeight: "900", marginBottom: 12 }}>
          🔍 Search
        </Text>
        <TextInput
          value={query}
          onChangeText={handleSearch}
          placeholder="Search by name or email..."
          placeholderTextColor="#4b5563"
          autoCapitalize="none"
          style={{
            backgroundColor: "#11131a",
            color: "white",
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "#252838",
            fontSize: 16,
          }}
        />
      </View>

      {/* RESULTS */}
      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color="#345bff" size="large" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={
            <View style={{ alignItems: "center", marginTop: 80 }}>
              {searched ? (
                <>
                  <Text style={{ fontSize: 48 }}>🔧</Text>
                  <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 16 }}>
                    No users found
                  </Text>
                  <Text style={{ color: "#9ca3af", marginTop: 8 }}>
                    Try a different search term
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 48 }}>👥</Text>
                  <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 16 }}>
                    Find People
                  </Text>
                  <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
                    Search for DIYers and Mechanics to follow
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#11131a",
              marginHorizontal: 16,
              marginTop: 12,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#252838",
              padding: 16,
            }}>
              {/* AVATAR */}
              <View style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#1f2937",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 2,
                borderColor: item.role === "MECHANIC" ? "#345bff" : "#10b981",
                overflow: "hidden",
                marginRight: 14,
              }}>
                {item.profilePhoto ? (
                  <Image
                    source={{ uri: item.profilePhoto }}
                    style={{ width: 52, height: 52, borderRadius: 26 }}
                  />
                ) : (
                  <Text style={{ color: "white", fontSize: 20, fontWeight: "bold" }}>
                    {item.name?.[0]?.toUpperCase() || "?"}
                  </Text>
                )}
              </View>

              {/* INFO */}
              <View style={{ flex: 1 }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16 }}>
                  {item.name || "Anonymous"}
                </Text>
                <View style={{
                  backgroundColor: item.role === "MECHANIC" ? "#1e3a8a" : "#064e3b",
                  paddingHorizontal: 8,
                  paddingVertical: 2,
                  borderRadius: 10,
                  alignSelf: "flex-start",
                  marginTop: 4,
                }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
                    {item.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
                  </Text>
                </View>
                <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
                  {item._count?.followers || 0} followers · {item._count?.posts || 0} posts
                </Text>
              </View>

              {/* FOLLOW BUTTON */}
              {item.id !== user?.id && (
                <TouchableOpacity
                  onPress={() => handleFollow(item.id)}
                  style={{
                    backgroundColor: following[item.id] ? "#1f2937" : "#345bff",
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: following[item.id] ? "#252838" : "#345bff",
                  }}
                >
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>
                    {following[item.id] ? "Following" : "Follow"}
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