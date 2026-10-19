import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, ScrollView, Text, TextInput, TouchableOpacity, View,
} from "react-native";

type SearchType = "posts" | "users" | "parts";

export default function Search() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [following, setFollowing] = useState<Record<number, boolean>>({});
  const [searchType, setSearchType] = useState<SearchType>("posts");
  const [suggestions, setSuggestions] = useState<any[]>([]);

  useFocusEffect(useCallback(() => {
    api.get("/api/users/suggestions").then(res => setSuggestions(res.data)).catch(() => {});
  }, []));

  // `type` is passed explicitly on tab switches — setSearchType() hasn't
  // landed yet at that point, so reading searchType here would search with
  // the OLD tab and render its results with the new tab's card.
  const handleSearch = async (text: string, type: SearchType = searchType) => {
    setQuery(text);
    if (text.trim().length < 2) { setResults([]); setSearched(false); return; }
    const q = encodeURIComponent(text.trim());
    try {
      setLoading(true);
      if (type === "parts") {
        const res = await api.get(`/api/parts?q=${q}`);
        setResults(res.data); setSearched(true);
      } else if (type === "users") {
        const res = await api.get(`/api/users/search?q=${q}`);
        setResults(res.data); setSearched(true);
        const followStatuses: Record<number, boolean> = {};
        await Promise.all(res.data.map(async (u: any) => {
          try {
            const fr = await api.get(`/api/users/${u.id}/follow-status`);
            followStatuses[u.id] = fr.data.following;
          } catch { followStatuses[u.id] = false; }
        }));
        setFollowing(followStatuses);
      } else {
        const res = await api.get(`/api/posts/search?q=${q}`);
        setResults(res.data); setSearched(true);
      }
    } catch (err) { console.error("SEARCH ERROR:", err); }
    finally { setLoading(false); }
  };

  const handleFollow = async (userId: number) => {
    try {
      await api.post(`/api/users/${userId}/follow`);
      setFollowing((prev) => ({ ...prev, [userId]: !prev[userId] }));
    } catch (err) { console.error("FOLLOW ERROR:", err); }
  };

  const handleTypeChange = (type: SearchType) => {
    setSearchType(type); setResults([]); setSearched(false);
    if (query.trim().length >= 2) handleSearch(query, type);
  };

  const formatPrice = (part: any) => {
    if (part.priceType === "FREE") return "🎁 Free";
    if (part.priceType === "TRADE") return "🔄 Trade";
    if (part.priceType === "OBO") return `$${part.price} OBO`;
    if (part.price) return `$${part.price}`;
    return "Make offer";
  };

  const TYPE_LABELS: Record<SearchType, { tab: string; placeholder: string; noun: string }> = {
    posts: { tab: "🔧 Posts", placeholder: "Search posts...", noun: "posts" },
    users: { tab: "👥 People", placeholder: "Search by name...", noun: "users" },
    parts: { tab: "🔩 Parts", placeholder: "Search parts for sale...", noun: "parts" },
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", marginBottom: 12 }}>🔍 Search</Text>

        <View style={{ flexDirection: "row", backgroundColor: colors.card, borderRadius: 12, padding: 4, marginBottom: 12 }}>
          {(["posts", "users", "parts"] as SearchType[]).map((t) => (
            <TouchableOpacity key={t} onPress={() => handleTypeChange(t)} style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center", backgroundColor: searchType === t ? colors.blue : "transparent" }}>
              <Text style={{ color: searchType === t ? "white" : colors.textMuted, fontWeight: "700", fontSize: 14 }}>{TYPE_LABELS[t].tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TextInput
          value={query} onChangeText={handleSearch}
          placeholder={TYPE_LABELS[searchType].placeholder}
          placeholderTextColor={colors.textMuted} autoCapitalize="none"
          style={{ backgroundColor: colors.card, color: colors.text, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, fontSize: 16 }}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator color={colors.blue} size="large" />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id.toString()}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            searched ? (
              <View style={{ alignItems: "center", marginTop: 80 }}>
                <Text style={{ fontSize: 48 }}>🔧</Text>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>No {TYPE_LABELS[searchType].noun} found</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Try a different search term</Text>
              </View>
            ) : searchType === "users" ? (
              <ScrollView contentContainerStyle={{ padding: 16 }}>
                {suggestions.length > 0 ? (
                  <>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 14 }}>PEOPLE YOU MAY KNOW</Text>
                    {suggestions.map((s: any) => (
                      <TouchableOpacity
                        key={s.id}
                        onPress={() => router.push(`/(tabs)/user/${s.id}`)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 }}
                      >
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.border, overflow: "hidden", justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: s.role === "MECHANIC" ? colors.blue : colors.green }}>
                          {s.profilePhoto ? (
                            <Image source={{ uri: s.profilePhoto }} style={{ width: 48, height: 48 }} />
                          ) : (
                            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>{s.name?.[0]?.toUpperCase()}</Text>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>{s.name}</Text>
                          <Text style={{ color: s.role === "MECHANIC" ? colors.blue : colors.green, fontSize: 12, marginTop: 2 }}>
                            {s.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
                          </Text>
                        </View>
                        <Text style={{ color: colors.textSecondary }}>→</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                ) : (
                  <View style={{ alignItems: "center", marginTop: 60 }}>
                    <Text style={{ fontSize: 48 }}>👥</Text>
                    <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>Find People</Text>
                    <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>Search for DIYers and Mechanics to follow</Text>
                  </View>
                )}
              </ScrollView>
            ) : searchType === "parts" ? (
              <View style={{ alignItems: "center", marginTop: 80 }}>
                <Text style={{ fontSize: 48 }}>🔩</Text>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>Search Parts</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>Find parts for sale or trade, e.g. "civic alternator"</Text>
              </View>
            ) : (
              <View style={{ alignItems: "center", marginTop: 80 }}>
                <Text style={{ fontSize: 48 }}>🔧</Text>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>Search Posts</Text>
                <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>Search for car questions, builds, and tips</Text>
              </View>
            )
          }
          renderItem={({ item }) => searchType === "parts" ? (
            <TouchableOpacity onPress={() => router.push(`/(tabs)/(parts)/${item.id}`)} style={{ flexDirection: "row", backgroundColor: colors.card, marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
              {item.imageUrl ? (
                <Image source={{ uri: item.imageUrl }} style={{ width: 96, height: 96 }} resizeMode="cover" />
              ) : (
                <View style={{ width: 96, height: 96, backgroundColor: colors.border, justifyContent: "center", alignItems: "center" }}>
                  <Text style={{ fontSize: 32 }}>🔩</Text>
                </View>
              )}
              <View style={{ flex: 1, padding: 12, justifyContent: "center" }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }} numberOfLines={2}>{item.title}</Text>
                <Text style={{ color: colors.green, fontWeight: "900", fontSize: 15, marginTop: 4 }}>{formatPrice(item)}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }} numberOfLines={1}>{item.category} · {item.condition} · {item.user?.name || "Anonymous"}</Text>
              </View>
            </TouchableOpacity>
          ) : searchType === "users" ? (
            <TouchableOpacity onPress={() => router.push(`/(tabs)/user/${item.id}`)} style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: item.role === "MECHANIC" ? colors.blue : colors.green, overflow: "hidden", marginRight: 14 }}>
                {item.profilePhoto ? (
                  <Image source={{ uri: item.profilePhoto }} style={{ width: 52, height: 52, borderRadius: 26 }} />
                ) : (
                  <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold" }}>{item.name?.[0]?.toUpperCase() || "?"}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>{item.name || "Anonymous"}</Text>
                <View style={{ backgroundColor: item.role === "MECHANIC" ? "#1e3a8a" : "#064e3b", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, alignSelf: "flex-start", marginTop: 4 }}>
                  <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{item.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{item._count?.followers || 0} followers · {item._count?.posts || 0} posts</Text>
              </View>
              {item.id !== user?.id && (
                <TouchableOpacity onPress={() => handleFollow(item.id)} style={{ backgroundColor: following[item.id] ? colors.card : colors.blue, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: following[item.id] ? colors.border : colors.blue }}>
                  <Text style={{ color: "white", fontSize: 13, fontWeight: "700" }}>{following[item.id] ? "Following" : "Follow"}</Text>
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => router.push(`/(tabs)/post/${item.id}`)} style={{ backgroundColor: colors.card, marginHorizontal: 16, marginTop: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16 }}>
              <View style={{ alignSelf: "flex-start", backgroundColor: item.postType === "QUESTION" ? "#1e3a8a" : "#064e3b", paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, marginBottom: 10 }}>
                <Text style={{ color: "white", fontSize: 11, fontWeight: "600" }}>{item.postType === "QUESTION" ? "🔧 Question" : "🚗 Vanity"}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: item.user?.role === "MECHANIC" ? colors.blue : colors.green }}>
                  <Text style={{ color: colors.text, fontSize: 13, fontWeight: "bold" }}>{item.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                </View>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.user?.name || "Anonymous"}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: "auto" }}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={{ color: colors.text, fontSize: 15, lineHeight: 22 }} numberOfLines={3}>{item.content}</Text>
              {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 160, borderRadius: 10, marginTop: 10 }} resizeMode="cover" />}
              <View style={{ flexDirection: "row", gap: 16, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>❤️ {item.likes?.length || 0}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>💬 {item.comments?.length || 0}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}
