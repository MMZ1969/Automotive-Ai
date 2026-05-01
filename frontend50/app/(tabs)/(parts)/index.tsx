import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    RefreshControl,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const CATEGORIES = ["All", "Engine", "Suspension", "Brakes", "Body", "Interior", "Tires", "Exhaust", "Electrical", "Other"];

const CONDITION_COLORS: Record<string, string> = {
  "New": "#10b981",
  "Like New": "#345bff",
  "Good": "#f59e0b",
  "Fair": "#f97316",
};

export default function PartsScreen() {
  const router = useRouter();
  const [parts, setParts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const fetchParts = async (category = activeCategory) => {
    try {
      const url = category === "All"
        ? "/api/parts"
        : `/api/parts?category=${encodeURIComponent(category)}`;
      const res = await api.get(url);
      setParts(res.data);
    } catch (err) {
      console.error("FETCH PARTS ERROR:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchParts(activeCategory);
    }, [activeCategory])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchParts(activeCategory);
  };

  const handleCategoryChange = (category: string) => {
    setActiveCategory(category);
    setLoading(true);
    fetchParts(category);
  };

  const formatPrice = (part: any) => {
    if (part.priceType === "FREE") return "🎁 Free";
    if (part.priceType === "TRADE") return "🔄 Trade";
    if (part.priceType === "OBO") return `$${part.price} OBO`;
    if (part.price) return `$${part.price}`;
    return "Make offer";
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
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: "white", fontSize: 28, fontWeight: "900" }}>🔩 Parts</Text>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 2 }}>Buy, sell & trade car parts</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/(parts)/add")}
            style={{
              backgroundColor: "#345bff",
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 14 }}>+ List Part</Text>
          </TouchableOpacity>
        </View>

        {/* CATEGORY FILTER */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginTop: 14 }}
          contentContainerStyle={{ gap: 8 }}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => handleCategoryChange(cat)}
              style={{
                backgroundColor: activeCategory === cat ? "#345bff" : "#11131a",
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: activeCategory === cat ? "#345bff" : "#252838",
              }}
            >
              <Text style={{
                color: activeCategory === cat ? "white" : "#9ca3af",
                fontWeight: "600",
                fontSize: 13,
              }}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LISTINGS */}
      <FlatList
        data={parts}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#345bff" />}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 80 }}>
            <Text style={{ fontSize: 48 }}>🔩</Text>
            <Text style={{ color: "white", fontSize: 20, fontWeight: "bold", marginTop: 16 }}>
              No parts listed yet
            </Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center", paddingHorizontal: 40 }}>
              Be the first to list a part for sale or trade!
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/(parts)/add")}
              style={{
                backgroundColor: "#345bff",
                paddingHorizontal: 24,
                paddingVertical: 12,
                borderRadius: 20,
                marginTop: 20,
              }}
            >
              <Text style={{ color: "white", fontWeight: "700" }}>+ List a Part</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/(parts)/${item.id}`)}
            style={{
              backgroundColor: "#11131a",
              borderRadius: 16,
              borderWidth: 1,
              borderColor: "#252838",
              overflow: "hidden",
            }}
          >
            {/* PART IMAGE */}
            {item.imageUrl && (
              <Image
                source={{ uri: item.imageUrl }}
                style={{ width: "100%", height: 180 }}
                resizeMode="cover"
              />
            )}

            <View style={{ padding: 14 }}>
              {/* TITLE + PRICE */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <Text style={{ color: "white", fontWeight: "700", fontSize: 16, flex: 1, marginRight: 8 }}>
                  {item.title}
                </Text>
                <Text style={{ color: "#10b981", fontWeight: "900", fontSize: 16 }}>
                  {formatPrice(item)}
                </Text>
              </View>

              {/* CATEGORY + CONDITION */}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <View style={{
                  backgroundColor: "#1f2937",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 10,
                }}>
                  <Text style={{ color: "#9ca3af", fontSize: 12, fontWeight: "600" }}>{item.category}</Text>
                </View>
                <View style={{
                  backgroundColor: (CONDITION_COLORS[item.condition] || "#6b7280") + "22",
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: CONDITION_COLORS[item.condition] || "#6b7280",
                }}>
                  <Text style={{ color: CONDITION_COLORS[item.condition] || "#6b7280", fontSize: 12, fontWeight: "600" }}>
                    {item.condition}
                  </Text>
                </View>
              </View>

              {/* DESCRIPTION */}
              {item.description && (
                <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 8, lineHeight: 18 }} numberOfLines={2}>
                  {item.description}
                </Text>
              )}

              {/* SELLER */}
              <View style={{ flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 }}>
                <View style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: "#252838",
                  justifyContent: "center",
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: item.user?.role === "MECHANIC" ? "#345bff" : "#10b981",
                }}>
                  <Text style={{ color: "white", fontSize: 10, fontWeight: "700" }}>
                    {item.user?.name?.[0]?.toUpperCase() || "?"}
                  </Text>
                </View>
                <Text style={{ color: "#6b7280", fontSize: 12 }}>
                  {item.user?.name || "Anonymous"} · ⭐ {item.user?.repPoints || 0} rep
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
