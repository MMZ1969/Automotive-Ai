import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function MechanicDashboard() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [jobCount, setJobCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [earnings, setEarnings] = useState(0);

  useFocusEffect(useCallback(() => {
    const fetchStats = async () => {
      try {
        const [bidsRes, reviewsRes] = await Promise.all([
          api.get("/api/jobs/my-bids"),
          api.get(`/api/reviews/${user?.id}`),
        ]);
        const acceptedBids = bidsRes.data.filter((b: any) => b.status === "ACCEPTED" && b.job?.status === "COMPLETED");
        setJobCount(acceptedBids.length);
        setEarnings(acceptedBids.reduce((sum: number, b: any) => sum + b.price, 0));
        setReviewCount(reviewsRes.data.total);
      } catch (err) { console.error("STATS ERROR:", err); }
    };
    fetchStats();
  }, [user]));

  if (!user || user.role !== "MECHANIC") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center" }}>
        <Text style={{ color: colors.text, fontSize: 20 }}>Mechanic access only</Text>
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ padding: 20 }}>
      <View style={{ marginBottom: 30, marginTop: 20 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>Welcome back 👋</Text>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "bold" }}>{user?.name || "Mechanic"}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 6 }}>Automotive Intelligence</Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        {[{ label: "Jobs", value: jobCount }, { label: "Reviews", value: reviewCount }, { label: "Earnings", value: `$${earnings}` }].map((stat, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginHorizontal: i === 1 ? 10 : 0 }}>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{stat.label}</Text>
            <Text style={{ color: colors.text, fontSize: 26, fontWeight: "bold", marginTop: 4 }}>{stat.value}</Text>
          </View>
        ))}
      </View>

      <Text style={{ color: colors.text, fontSize: 20, fontWeight: "700", marginBottom: 12 }}>Actions</Text>

      <TouchableOpacity onPress={() => router.push("/(tabs)/mechanic/jobs")} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>🔧 Jobs Near Me</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>Find work and place bids</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/quick-alert")} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: "#f59e0b44", marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>⚡ Quick Alert</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>Send a customer a vehicle status update</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(tabs)/mechanic/reviews")} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>⭐ Reviews</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>See what customers are saying</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => router.push("/(tabs)/(profile)")} style={{ backgroundColor: colors.card, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
        <Text style={{ color: colors.text, fontSize: 18, fontWeight: "700" }}>👤 My Profile</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 4, fontSize: 13 }}>View your profile and reputation</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
