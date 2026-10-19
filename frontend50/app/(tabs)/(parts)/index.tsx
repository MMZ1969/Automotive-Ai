import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, RefreshControl,
  ScrollView, Text, TextInput, TouchableOpacity, View,
} from "react-native";

const CATEGORIES = ["All", "Engine", "Suspension", "Brakes", "Body", "Interior", "Tires", "Exhaust", "Electrical", "Other"];
const CONDITION_COLORS: Record<string, string> = { "New": "#10b981", "Like New": "#345bff", "Good": "#f59e0b", "Fair": "#f97316" };

export default function PartsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [query, setQuery] = useState("");
  const queryRef = useRef("");
  // Only the newest request is allowed to set results, so a slow response
  // for "sil" can't overwrite the results for "silverado".
  const requestId = useRef(0);

  const fetchParts = async (category = activeCategory, q = queryRef.current) => {
    const myId = ++requestId.current;
    try {
      const params = new URLSearchParams();
      if (category !== "All") params.set("category", category);
      if (q.trim().length >= 2) params.set("q", q.trim());
      const qs = params.toString();
      const res = await api.get(qs ? `/api/parts?${qs}` : "/api/parts");
      if (myId === requestId.current) setParts(res.data);
    } catch (err) { console.error("FETCH PARTS ERROR:", err); }
    finally {
      if (myId === requestId.current) { setLoading(false); setRefreshing(false); setSearching(false); }
    }
  };

  useFocusEffect(useCallback(() => { fetchParts(activeCategory); }, [activeCategory]));
  const onRefresh = () => { setRefreshing(true); fetchParts(activeCategory); };
  const handleCategoryChange = (category: string) => { setActiveCategory(category); setSearching(true); fetchParts(category); };

  // Debounced search: wait until typing pauses before hitting the server.
  const didMount = useRef(false);
  useEffect(() => {
    queryRef.current = query;
    if (!didMount.current) { didMount.current = true; return; } // focus effect does the first load
    const trimmed = query.trim();
    if (trimmed.length === 1) return; // one letter is too broad to bother
    setSearching(true);
    const t = setTimeout(() => fetchParts(activeCategory, query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const formatPrice = (part: any) => {
    if (part.priceType === "FREE") return "🎁 Free";
    if (part.priceType === "TRADE") return "🔄 Trade";
    if (part.priceType === "OBO") return `$${part.price} OBO`;
    if (part.price) return `$${part.price}`;
    return "Make offer";
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  const isFiltered = query.trim().length >= 2 || activeCategory !== "All";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: colors.text, fontSize: 28, fontWeight: "900" }}>🔩 Parts</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>Buy, sell & trade car parts</Text>
          </View>
          <TouchableOpacity onPress={() => router.push("/(tabs)/(parts)/add")} style={{ backgroundColor: colors.blue, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ List Part</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginTop: 14 }}>
          <TextInput
            value={query} onChangeText={setQuery}
            placeholder="Search parts (e.g. silverado headlight)"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none" autoCorrect={false} returnKeyType="search"
            style={{ flex: 1, color: colors.text, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 }}
          />
          {searching ? (
            <ActivityIndicator color={colors.blue} size="small" style={{ marginRight: 12 }} />
          ) : query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery("")} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
              <Text style={{ color: colors.textMuted, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }} keyboardShouldPersistTaps="handled">
          {CATEGORIES.map((cat) => (
            <TouchableOpacity key={cat} onPress={() => handleCategoryChange(cat)}
              style={{ backgroundColor: activeCategory === cat ? colors.blue : colors.card, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: activeCategory === cat ? colors.blue : colors.border }}>
              <Text style={{ color: activeCategory === cat ? "white" : colors.textSecondary, fontWeight: "600", fontSize: 13 }}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={parts}
        keyExtractor={(item) => item.id.toString()}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.blue} />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          isFiltered ? (
            <View style={{ alignItems: "center", marginTop: 80 }}>
              <Text style={{ fontSize: 48 }}>🔍</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>No matching parts</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
                {query.trim().length >= 2 ? `Nothing listed for "${query.trim()}"` : "Nothing listed in this category yet"}
                {activeCategory !== "All" ? ` in ${activeCategory}` : ""}. Try fewer words or another category.
              </Text>
            </View>
          ) : (
            <View style={{ alignItems: "center", marginTop: 80 }}>
              <Text style={{ fontSize: 48 }}>🔩</Text>
              <Text style={{ color: colors.text, fontSize: 20, fontWeight: "bold", marginTop: 16 }}>No parts listed yet</Text>
              <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>Be the first to list a part for sale or trade!</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/(parts)/add")} style={{ backgroundColor: colors.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 20, marginTop: 20 }}>
                <Text style={{ color: "white", fontWeight: "700" }}>+ List a Part</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push(`/(tabs)/(parts)/${item.id}`)}
            style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, overflow: "hidden" }}>
            {item.imageUrl && <Image source={{ uri: item.imageUrl }} style={{ width: "100%", height: 180 }} resizeMode="cover" />}
            <View style={{ padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16, flex: 1, marginRight: 8 }}>{item.title}</Text>
                <Text style={{ color: colors.green, fontWeight: "900", fontSize: 16 }}>{formatPrice(item)}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{ backgroundColor: colors.border, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 }}>
                  <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: "600" }}>{item.category}</Text>
                </View>
                <View style={{ backgroundColor: (CONDITION_COLORS[item.condition] || "#6b7280") + "22", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: CONDITION_COLORS[item.condition] || "#6b7280" }}>
                  <Text style={{ color: CONDITION_COLORS[item.condition] || "#6b7280", fontSize: 12, fontWeight: "600" }}>{item.condition}</Text>
                </View>
              </View>
              {item.description && <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 8, lineHeight: 18 }} numberOfLines={2}>{item.description}</Text>}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 }}>
                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.border, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: item.user?.role === "MECHANIC" ? colors.blue : colors.green }}>
                  <Text style={{ color: colors.text, fontSize: 10, fontWeight: "700" }}>{item.user?.name?.[0]?.toUpperCase() || "?"}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{item.user?.name || "Anonymous"} · ⭐ {item.user?.repPoints || 0} rep</Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
