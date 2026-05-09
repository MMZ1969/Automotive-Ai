import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useRouter } from "expo-router";
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
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [following, setFollowing] = useState<Record<number, boolean>>({});
  const [searchType, setSearchType] = useState<"users" | "posts">("posts");

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    try {
      setLoading(true);
      if (searchType === "users") {
        const res = await api.get(`/api/users/search?q=${text}`);
        setResults(res.data);
        setSearched(true);
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
      } else {
        const res = await api.get(`/api/posts/search?q=${text}`);
        setResults(res.data);
        setSearched(true);
      }
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

  const handleTypeChange = (type: "users" | "posts") => {
    setSearchType(type);
    setResults([]);
    setSearched(false);
    if (query.trim().length >= 2) {
      handleSearch(query);
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

        {/* SEARCH TYPE TOGGLE */}
        <View style={{
          flexDirection: "row",
          backgroundColor: "#11131a",
          borderRadius: 12,
          padding: 4,
          marginBottom: 12,
        }}>
          <TouchableOpacity
            onPress={() => handleTypeChange("posts")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: searchType === "posts" ? "#345bff" : "transparent",
            }}
          >
            <Text style={{
              color: searchType === "posts" ? "white" : "#6b7280",
              fontWeight: "700",
              fontSize: 14,
            }}>🔧 Posts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleTypeChange("users")}
            style={{
              flex: 1,
              paddingVertical: 8,
              borderRadius: 10,
              alignItems: "center",
              backgroundColor: searchType === "users" ? "#345bff" : "transparent",
            }}
          >
            <Text style={{
              color: searchType === "users" ? "white" : "#6b7280",
              fontWeight: "700",
              fontSize: 14,
            }}>👥 People</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          value={query}
          onChangeText={handleSearch}
          placeholder={searchType === "posts" ? "Search posts..." : "Search by name or email..."}
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
                    No {searchType === "posts" ? "posts" : "users"} found
                  </Text>
                  <Text style={{ color: "#9ca3af", marginTop: 8 }}>
                    Try a different search term
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 48 }}>{searchType === "posts" ? "🔧" : "👥"}</Text>
                  <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 16 }}>
                    {searchType === "posts" ? "Search Posts" : "Find People"}
                  </Text>
                  <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
                    {searchType === "posts"
                      ? "Search for car questions, builds, and tips"
                      : "Search for DIYers and Mechanics to follow"}
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={({ item }) =>
            searchType === "users" ? (
              /* USER RESULT */
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
            ) : (
              /* POST RESULT */
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/post/${item.id}`)}
                style={{
                  backgroundColor: "#11131a",
                  marginHorizontal: 16,
                  marginTop: 12,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: "#252838",
                  padding: 16,
                }}
              >
                {/* POST TYPE BADGE */}
                <View style={{
                  alignSelf: "flex-start",
                  backgroundColor: item.postType === "QUESTION" ? "#1e3a8a" : "#064e3b",
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 10,
                  marginBottom: 10,
                }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>
                    {item.postType === "QUESTION" ? "🔧 Question" : "🚗 Vanity"}
                  </Text>
                </View>

                {/* POST AUTHOR */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <View style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    backgroundColor: "#1f2937",
                    justifyContent: "center",
                    alignItems: "center",
                    borderWidth: 1,
                    borderColor: item.user?.role === "MECHANIC" ? "#345bff" : "#10b981",
                  }}>
                    <Text style={{ color: "white", fontSize: 13, fontWeight: "bold" }}>
                      {item.user?.name?.[0]?.toUpperCase() || "?"}
                    </Text>
                  </View>
                  <Text style={{ color: "#9ca3af", fontSize: 13 }}>
                    {item.user?.name || "Anonymous"}
                  </Text>
                  <Text style={{ color: "#6b7280", fontSize: 12, marginLeft: "auto" }}>
                    {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                {/* POST CONTENT */}
                <Text
                  style={{ color: "#e5e7eb", fontSize: 15, lineHeight: 22 }}
                  numberOfLines={3}
                >
                  {item.content}
                </Text>

                {/* POST IMAGE */}
                {item.imageUrl && (
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={{ width: "100%", height: 160, borderRadius: 10, marginTop: 10 }}
                    resizeMode="cover"
                  />
                )}

                {/* STATS */}
                <View style={{
                  flexDirection: "row",
                  gap: 16,
                  marginTop: 10,
                  paddingTop: 10,
                  borderTopWidth: 1,
                  borderTopColor: "#252838",
                }}>
                  <Text style={{ color: "#6b7280", fontSize: 13 }}>
                    ❤️ {item.likes?.length || 0}
                  </Text>
                  <Text style={{ color: "#6b7280", fontSize: 13 }}>
                    💬 {item.comments?.length || 0}
                  </Text>
                </View>
              </TouchableOpacity>
            )
          }
        />
      )}
    </View>
  );
}