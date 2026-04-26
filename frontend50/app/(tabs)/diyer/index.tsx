import { useAuth } from "@context/AuthContext";
import api from "@lib/api";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function DiyerDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [postCount, setPostCount] = useState(0);
  const [vehicleCount, setVehicleCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      const fetchStats = async () => {
        try {
          const [postsRes, vehiclesRes] = await Promise.all([
            api.get("/api/posts"),
            api.get("/api/vehicles"),
          ]);
          const myPosts = postsRes.data.filter((p: any) => p.userId === user?.id);
          setPostCount(myPosts.length);
          setVehicleCount(vehiclesRes.data.length);
        } catch (err) {
          console.error("STATS ERROR:", err);
        }
      };
      fetchStats();
    }, [user])
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#050509" }}
      contentContainerStyle={{ padding: 20 }}
    >
      {/* HEADER */}
      <View style={{ marginBottom: 30, marginTop: 20 }}>
        <Text style={{ color: "#9ca3af", fontSize: 14, marginBottom: 4 }}>
          Welcome back 👋
        </Text>
        <Text style={{ color: "white", fontSize: 30, fontWeight: "bold" }}>
          {user?.name || "DIYer"}
        </Text>
        <Text style={{ color: "#9ca3af", marginTop: 6 }}>
          Automotive Intelligence
        </Text>
      </View>

      {/* QUICK STATS */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
        <View style={statCard}>
          <Text style={{ color: "#9fa4c0", fontSize: 13 }}>My Vehicles</Text>
          <Text style={statNumber}>{vehicleCount}</Text>
        </View>

        <View style={[statCard, { marginHorizontal: 10 }]}>
          <Text style={{ color: "#9fa4c0", fontSize: 13 }}>Posts</Text>
          <Text style={statNumber}>{postCount}</Text>
        </View>

        <View style={statCard}>
          <Text style={{ color: "#9fa4c0", fontSize: 13 }}>Rep Points</Text>
          <Text style={statNumber}>0</Text>
        </View>
      </View>

      {/* CREATE POST */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/create")}
        style={{
          backgroundColor: "#345bff",
          padding: 16,
          borderRadius: 14,
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
          + Share a Build or Question
        </Text>
      </TouchableOpacity>

      {/* MY GARAGE */}
      <Text style={sectionTitle}>My Garage</Text>
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)/vehicles")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>🚗 View My Vehicles</Text>
        <Text style={actionCardSub}>Manage your garage and logs</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)/logs")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>📋 Maintenance Logs</Text>
        <Text style={actionCardSub}>Track repairs and modifications</Text>
      </TouchableOpacity>

      {/* COMMUNITY */}
      <Text style={[sectionTitle, { marginTop: 10 }]}>Community</Text>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/feed")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>🔍 Explore Feed</Text>
        <Text style={actionCardSub}>See what other motorheads are building</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/create")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>❓ Ask a Question</Text>
        <Text style={actionCardSub}>Get help from experts and the community</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>👤 My Profile</Text>
        <Text style={actionCardSub}>View your posts, badges and rep</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const statCard = {
  flex: 1,
  backgroundColor: "#11131a",
  padding: 16,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#252838",
};

const statNumber = {
  color: "white",
  fontSize: 26,
  fontWeight: "bold" as const,
  marginTop: 4,
};

const sectionTitle = {
  color: "white",
  fontSize: 20,
  fontWeight: "700" as const,
  marginBottom: 12,
};

const actionCard = {
  backgroundColor: "#11131a",
  padding: 16,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: "#252838",
  marginBottom: 12,
};

const actionCardTitle = {
  color: "#f5f5f5",
  fontSize: 18,
  fontWeight: "700" as const,
};

const actionCardSub = {
  color: "#9fa4c0",
  marginTop: 4,
  fontSize: 13,
};