import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";

export default function MechanicReviews() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    const fetchReviews = async () => {
      try {
        const res = await api.get(`/api/reviews/${user?.id}`);
        setReviews(res.data.reviews);
        setAvgRating(res.data.avgRating);
        setTotal(res.data.total);
      } catch (err) { console.error("FETCH REVIEWS ERROR:", err); }
      finally { setLoading(false); }
    };
    fetchReviews();
  }, []));

  const renderStars = (rating: number) => "⭐".repeat(rating) + "☆".repeat(5 - rating);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color={colors.blue} size="large" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ paddingTop: 60, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: colors.blue, fontSize: 16 }}>← Back</Text>
        </TouchableOpacity>
        <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>⭐ My Reviews</Text>
      </View>

      {total > 0 && (
        <View style={{ margin: 16, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, alignItems: "center" }}>
          <Text style={{ color: colors.text, fontSize: 48, fontWeight: "900" }}>{avgRating}</Text>
          <Text style={{ fontSize: 24, marginVertical: 4 }}>{renderStars(Math.round(avgRating))}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{total} review{total !== 1 ? "s" : ""}</Text>
        </View>
      )}

      <FlatList
        data={reviews}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16 }}
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ fontSize: 48 }}>⭐</Text>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700", marginTop: 16 }}>No reviews yet</Text>
            <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: "center" }}>Complete jobs to start earning reviews!</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={{ backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: colors.text, fontWeight: "700" }}>{item.reviewer?.name || "DIYer"}</Text>
              <Text style={{ fontSize: 16 }}>{renderStars(item.rating)}</Text>
            </View>
            {item.comment && <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, marginBottom: 8 }}>"{item.comment}"</Text>}
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>🔧 {item.job?.title} — {item.job?.vehicle}</Text>
          </View>
        )}
      />
    </View>
  );
}
