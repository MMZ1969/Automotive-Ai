import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

export default function MechanicReviews() {
  const { user } = useAuth();
  const router = useRouter();
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      const fetchReviews = async () => {
        try {
          const res = await api.get(`/api/reviews/${user?.id}`);
          setReviews(res.data.reviews);
          setAvgRating(res.data.avgRating);
          setTotal(res.data.total);
        } catch (err) {
          console.error("FETCH REVIEWS ERROR:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchReviews();
    }, [])
  );

  const renderStars = (rating: number) => {
    return "⭐".repeat(rating) + "☆".repeat(5 - rating);
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
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: "#252838",
        flexDirection: "row", alignItems: "center", gap: 12,
      }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: "#345bff", fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 22, fontWeight: "900" }}>⭐ My Reviews</Text>
      </View>

      {/* RATING SUMMARY */}
      {total > 0 && (
        <View style={{
          margin: 16,
          backgroundColor: "#11131a",
          borderRadius: 16,
          borderWidth: 1,
          borderColor: "#252838",
          padding: 20,
          alignItems: "center",
        }}>
          <Text style={{ color: "white", fontSize: 48, fontWeight: "900" }}>{avgRating}</Text>
          <Text style={{ fontSize: 24, marginVertical: 4 }}>{renderStars(Math.round(avgRating))}</Text>
          <Text style={{ color: "#9ca3af", fontSize: 14 }}>{total} review{total !== 1 ? "s" : ""}</Text>
        </View>
      )}

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>⭐</Text>
            <Text style={{ color: "white", fontSize: 18, fontWeight: "700", marginTop: 16 }}>No reviews yet</Text>
            <Text style={{ color: "#9ca3af", marginTop: 8, textAlign: "center" }}>
              Complete jobs to start earning reviews!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{
            backgroundColor: "#11131a",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#252838",
            padding: 16,
            marginBottom: 12,
          }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: "white", fontWeight: "700" }}>{item.reviewer?.name || "DIYer"}</Text>
              <Text style={{ fontSize: 16 }}>{renderStars(item.rating)}</Text>
            </View>
            {item.comment && (
              <Text style={{ color: "#e5e7eb", fontSize: 14, lineHeight: 20, marginBottom: 8 }}>
                "{item.comment}"
              </Text>
            )}
            <Text style={{ color: "#6b7280", fontSize: 12 }}>
              🔧 {item.job?.title} — {item.job?.vehicle}
            </Text>
          </View>
        )}
      />
    </View>
  );
}