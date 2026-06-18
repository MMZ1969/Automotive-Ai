import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function Explore() {
  const { colors } = useTheme();
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  useFocusEffect(useCallback(() => {
    api.get("/api/users/suggestions").then(res => setSuggestions(res.data)).catch(() => {});
  }, []));

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      setSearched(false);
      return;
    }
    try {
      setSearching(true);
      const res = await api.get(`/api/users/search?q=${encodeURIComponent(text)}`);
      setSearchResults(res.data);
      setSearched(true);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const UserCard = ({ user }: { user: any }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(tabs)/user/${user.id}`)}
      style={{
        flexDirection: "row", alignItems: "center", gap: 12,
        backgroundColor: colors.card, borderRadius: 14, borderWidth: 1,
        borderColor: colors.border, padding: 14, marginBottom: 10,
      }}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 26, backgroundColor: colors.border,
        overflow: "hidden", justifyContent: "center", alignItems: "center",
        borderWidth: 2, borderColor: user.role === "MECHANIC" ? colors.blue : colors.green,
      }}>
        {user.profilePhoto ? (
          <Image source={{ uri: user.profilePhoto }} style={{ width: 52, height: 52 }} />
        ) : (
          <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700" }}>{user.name?.[0]?.toUpperCase()}</Text>
        )}
      </View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 15, fontWeight: "700" }}>{user.name}</Text>
          {user.isVerified && user.role === "MECHANIC" && (
            <View style={{ backgroundColor: "#1e3a8a", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: "#60a5fa" }}>
              <Text style={{ color: "white", fontSize: 9, fontWeight: "700" }}>✓ Verified</Text>
            </View>
          )}
        </View>
        <Text style={{ color: user.role === "MECHANIC" ? colors.blue : colors.green, fontSize: 12, marginTop: 2 }}>
          {user.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
        </Text>
        {user.location && (
          <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 2 }}>📍 {user.location}</Text>
        )}
      </View>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>→</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>

      {/* HEADER */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900", marginBottom: 14 }}>Explore</Text>

        {/* SEARCH BAR */}
        <View style={{
          flexDirection: "row", alignItems: "center", gap: 10,
          backgroundColor: colors.card, borderRadius: 12, borderWidth: 1,
          borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 10,
        }}>
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            value={searchQuery}
            onChangeText={handleSearch}
            placeholder="Search users..."
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, color: colors.text, fontSize: 15 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => { setSearchQuery(""); setSearchResults([]); setSearched(false); }}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* SEARCH RESULTS */}
      {searchQuery.length > 0 ? (
        <View style={{ flex: 1, padding: 20 }}>
          {searching ? (
            <ActivityIndicator color={colors.blue} style={{ marginTop: 40 }} />
          ) : searched && searchResults.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 60 }}>
              <Text style={{ fontSize: 40 }}>🔍</Text>
              <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>No users found</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8 }}>Try a different name</Text>
            </View>
          ) : (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => <UserCard user={item} />}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      ) : (
        /* PEOPLE YOU MAY KNOW */
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }}>
          {suggestions.length > 0 && (
            <View>
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: 14 }}>
                PEOPLE YOU MAY KNOW
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {suggestions.map((s: any) => (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => router.push(`/(tabs)/user/${s.id}`)}
                    style={{
                      alignItems: "center", width: "30%",
                      backgroundColor: colors.card, borderRadius: 14,
                      borderWidth: 1, borderColor: colors.border, padding: 14,
                    }}
                  >
                    <View style={{
                      width: 56, height: 56, borderRadius: 28, backgroundColor: colors.border,
                      overflow: "hidden", justifyContent: "center", alignItems: "center",
                      borderWidth: 2, borderColor: s.role === "MECHANIC" ? colors.blue : colors.green,
                      marginBottom: 8,
                    }}>
                      {s.profilePhoto ? (
                        <Image source={{ uri: s.profilePhoto }} style={{ width: 56, height: 56 }} />
                      ) : (
                        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "700" }}>{s.name?.[0]?.toUpperCase()}</Text>
                      )}
                    </View>
                    <Text style={{ color: colors.text, fontSize: 12, fontWeight: "600", textAlign: "center" }} numberOfLines={1}>{s.name}</Text>
                    <Text style={{ color: s.role === "MECHANIC" ? colors.blue : colors.green, fontSize: 10, marginTop: 2 }}>
                      {s.role === "MECHANIC" ? "🏁 Mechanic" : "🚗 DIYer"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {suggestions.length === 0 && (
            <View style={{ alignItems: "center", marginTop: 80 }}>
              <Text style={{ fontSize: 48 }}>🔍</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>Discover People</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>Search for users or check back soon for suggestions</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}
