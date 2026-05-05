import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const CONDITION_COLORS: Record<string, string> = {
  "New": "#10b981",
  "Like New": "#345bff",
  "Good": "#f59e0b",
  "Fair": "#f97316",
};

export default function PartDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [part, setPart] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPart = async () => {
      try {
        const res = await api.get(`/api/parts/${id}`);
        setPart(res.data);
      } catch (err) {
        console.error("FETCH PART ERROR:", err);
        Alert.alert("Error", "Could not load this listing.");
        router.back();
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchPart();
  }, [id]);

  const formatPrice = (part: any) => {
    if (part.priceType === "FREE") return "🎁 Free";
    if (part.priceType === "TRADE") return "🔄 Trade Only";
    if (part.priceType === "OBO") return `$${part.price} OBO`;
    if (part.price) return `$${part.price}`;
    return "Make offer";
  };

  const handleContact = () => {
    if (!part?.user) return;
    Alert.alert(
      "Contact Seller",
      `How would you like to contact ${part.user.name}?`,
      [
        part.user.phone ? {
          text: "📞 Call",
          onPress: () => Linking.openURL(`tel:${part.user.phone}`),
        } : null,
        part.user.phone ? {
          text: "💬 Text",
          onPress: () => Linking.openURL(`sms:${part.user.phone}`),
        } : null,
        {
          text: "👤 View Profile",
          onPress: () => router.push(`/(tabs)/user/${part.user.id}`),
        },
        { text: "Cancel", style: "cancel" },
      ].filter(Boolean) as any[]
    );
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#345bff" size="large" />
      </View>
    );
  }

  if (!part) return null;

  const isOwner = user?.id === part.userId;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#050509" }}>
      {/* BACK BUTTON */}
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
      </View>

      {/* IMAGE */}
      {part.imageUrl && (
        <Image
          source={{ uri: part.imageUrl }}
          style={{ width: "100%", height: 280 }}
          resizeMode="cover"
        />
      )}

      <View style={{ padding: 20 }}>

        {/* TITLE + PRICE */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <Text style={{ color: "white", fontSize: 22, fontWeight: "900", flex: 1, marginRight: 12 }}>
            {part.title}
          </Text>
          <Text style={{ color: "#10b981", fontSize: 22, fontWeight: "900" }}>
            {formatPrice(part)}
          </Text>
        </View>

        {/* BADGES */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          <View style={{
            backgroundColor: "#1f2937",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
          }}>
            <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "600" }}>
              {part.category}
            </Text>
          </View>
          <View style={{
            backgroundColor: (CONDITION_COLORS[part.condition] || "#6b7280") + "22",
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: CONDITION_COLORS[part.condition] || "#6b7280",
          }}>
            <Text style={{ color: CONDITION_COLORS[part.condition] || "#6b7280", fontSize: 13, fontWeight: "600" }}>
              {part.condition}
            </Text>
          </View>
        </View>

        {/* DESCRIPTION */}
        {part.description && (
          <View style={{
            backgroundColor: "#11131a",
            borderRadius: 14,
            borderWidth: 1,
            borderColor: "#252838",
            padding: 16,
            marginBottom: 16,
          }}>
            <Text style={{ color: "#9ca3af", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
              Description
            </Text>
            <Text style={{ color: "white", fontSize: 15, lineHeight: 22 }}>
              {part.description}
            </Text>
          </View>
        )}

        {/* SELLER INFO */}
        <View style={{
          backgroundColor: "#11131a",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#252838",
          padding: 16,
          marginBottom: 20,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}>
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#252838",
            justifyContent: "center",
            alignItems: "center",
            borderWidth: 2,
            borderColor: part.user?.role === "MECHANIC" ? "#345bff" : "#10b981",
          }}>
            {part.user?.profilePhoto ? (
              <Image source={{ uri: part.user.profilePhoto }} style={{ width: 44, height: 44, borderRadius: 22 }} />
            ) : (
              <Text style={{ color: "white", fontSize: 18, fontWeight: "700" }}>
                {part.user?.name?.[0]?.toUpperCase() || "?"}
              </Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
              {part.user?.name || "Anonymous"}
            </Text>
            <Text style={{ color: "#6b7280", fontSize: 12, marginTop: 2 }}>
              ⭐ {part.user?.repPoints || 0} rep · {part.user?.role === "MECHANIC" ? "🏁 Mechanic" : "🔧 DIYer"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push(`/(tabs)/user/${part.user?.id}`)}
          >
            <Text style={{ color: "#345bff", fontSize: 13, fontWeight: "600" }}>View →</Text>
          </TouchableOpacity>
        </View>

        {/* CONTACT BUTTON — only show if not owner */}
        {!isOwner && (
          <TouchableOpacity
            onPress={handleContact}
            style={{
              backgroundColor: "#345bff",
              paddingVertical: 18,
              borderRadius: 16,
              alignItems: "center",
              marginBottom: 40,
            }}
          >
            <Text style={{ color: "white", fontWeight: "700", fontSize: 18 }}>
              📞 Contact Seller
            </Text>
          </TouchableOpacity>
        )}

        {/* DELETE — only show if owner */}
        {isOwner && (
          <TouchableOpacity
            onPress={() => {
              Alert.alert(
                "Delete Listing",
                "Are you sure you want to delete this listing?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: async () => {
                      try {
                        await api.delete(`/api/parts/${id}`);
                        router.back();
                      } catch (err) {
                        Alert.alert("Error", "Could not delete listing.");
                      }
                    },
                  },
                ]
              );
            }}
            style={{
              backgroundColor: "#0a0a0a",
              paddingVertical: 16,
              borderRadius: 16,
              alignItems: "center",
              marginBottom: 40,
              borderWidth: 1,
              borderColor: "#ef444444",
            }}
          >
            <Text style={{ color: "#ef4444", fontWeight: "700", fontSize: 16 }}>
              🗑️ Delete Listing
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
