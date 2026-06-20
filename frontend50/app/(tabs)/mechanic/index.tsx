import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, Switch, Text, TouchableOpacity, View } from "react-native";

export default function MechanicDashboard() {
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const router = useRouter();
  const [jobCount, setJobCount] = useState(0);
  const [reviewCount, setReviewCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(user?.isAvailable ?? true);
  const [togglingAvailability, setTogglingAvailability] = useState(false);

  const handleToggleAvailability = async () => {
    try {
      setTogglingAvailability(true);
      const res = await api.post("/api/users/availability");
      setIsAvailable(res.data.isAvailable);
    } catch (err) {
      console.error("TOGGLE AVAILABILITY ERROR:", err);
      Alert.alert("Error", "Could not update availability.");
    } finally {
      setTogglingAvailability(false);
    }
  };

  // Refresh live user status (verified, role, etc.) every time the dashboard focuses
  useFocusEffect(useCallback(() => {
    refreshUser();
  }, []));

  useFocusEffect(useCallback(() => {
    const fetchStats = async () => {
      try {
        const [jobsRes, reviewsRes] = await Promise.all([
          api.get("/api/jobs/my-bids"),
          api.get(`/api/reviews/${user?.id}`),
        ]);
        const completedJobs = jobsRes.data.filter((j: any) => j.status === "COMPLETED");
        setJobCount(completedJobs.length);
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

      {/* VERIFICATION BANNER */}
      {!user?.isVerified && (
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/mechanic/verify")}
          style={{
            backgroundColor: "#1a1200",
            borderWidth: 1.5,
            borderColor: "#f59e0b",
            borderRadius: 14,
            padding: 16,
            marginBottom: 20,
            marginTop: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Text style={{ fontSize: 28 }}>🏁</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: "#fcd34d", fontSize: 15, fontWeight: "700" }}>Get Verified & Appear on the Map</Text>
            <Text style={{ color: "#9ca3af", fontSize: 13, marginTop: 3 }}>
              Verified mechanics show up in Near Me searches and get more job requests. Tap to apply.
            </Text>
          </View>
          <Text style={{ color: "#f59e0b", fontSize: 18 }}>›</Text>
        </TouchableOpacity>
      )}

      <View style={{ marginBottom: 30, marginTop: 10 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 4 }}>Welcome back 👋</Text>
        <Text style={{ color: colors.text, fontSize: 30, fontWeight: "bold" }}>{user?.name || "Mechanic"}</Text>
        <Text style={{ color: colors.textSecondary, marginTop: 6 }}>Automotive Intelligence</Text>
      </View>

      {/* AVAILABILITY TOGGLE */}
      <TouchableOpacity
        onPress={handleToggleAvailability}
        disabled={togglingAvailability}
        style={{
          backgroundColor: isAvailable ? "#06402b" : colors.card,
          borderRadius: 14, borderWidth: 1,
          borderColor: isAvailable ? colors.green : colors.border,
          padding: 16, marginBottom: 16,
          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <View>
          <Text style={{ color: isAvailable ? colors.green : colors.text, fontWeight: "700", fontSize: 16 }}>
            {isAvailable ? "🟢 Available for Jobs" : "🔴 Not Available"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
            {isAvailable ? "Customers can find and contact you" : "You won't appear as available on the map"}
          </Text>
        </View>
        <Switch
          value={isAvailable}
          onValueChange={handleToggleAvailability}
          trackColor={{ false: colors.border, true: colors.green }}
          thumbColor="white"
          disabled={togglingAvailability}
        />
      </TouchableOpacity>

      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        {[{ label: "Jobs Completed", value: jobCount }, { label: "Reviews", value: reviewCount }].map((stat, i) => (
          <View key={i} style={{ flex: 1, backgroundColor: colors.card, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.border, marginHorizontal: i === 0 ? 0 : 10 }}>
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