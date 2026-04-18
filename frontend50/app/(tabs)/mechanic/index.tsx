import { useAuth } from "@context/AuthContext";
import { useRouter } from "expo-router";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

export default function MechanicDashboard() {
  const { user } = useAuth();
  const router = useRouter();

  // Guard - if somehow a DIYER lands here
  if (!user || user.role !== "MECHANIC") {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#050509",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text style={{ color: "white", fontSize: 20 }}>
          Mechanic access only
        </Text>
      </View>
    );
  }

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
          {user?.name || "Mechanic"}
        </Text>
        <Text style={{ color: "#9ca3af", marginTop: 6 }}>
          Automotive Intelligence
        </Text>
      </View>

      {/* QUICK STATS */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <View style={statCard}>
          <Text style={{ color: "#9fa4c0", fontSize: 13 }}>Jobs</Text>
          <Text style={statNumber}>0</Text>
        </View>

        <View style={[statCard, { marginHorizontal: 10 }]}>
          <Text style={{ color: "#9fa4c0", fontSize: 13 }}>Reviews</Text>
          <Text style={statNumber}>0</Text>
        </View>

        <View style={statCard}>
          <Text style={{ color: "#9fa4c0", fontSize: 13 }}>Earnings</Text>
          <Text style={statNumber}>$0</Text>
        </View>
      </View>

      {/* ACTIONS */}
      <Text style={sectionTitle}>Actions</Text>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/mechanic/jobs")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>🔧 View Jobs</Text>
        <Text style={actionCardSub}>See open and completed jobs</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/mechanic/reviews")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>⭐ Reviews</Text>
        <Text style={actionCardSub}>See what customers are saying</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/mechanic/earnings")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>💰 Earnings</Text>
        <Text style={actionCardSub}>Track your income</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push("/(tabs)/(profile)")}
        style={actionCard}
      >
        <Text style={actionCardTitle}>👤 My Profile</Text>
        <Text style={actionCardSub}>View your profile and reputation</Text>
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