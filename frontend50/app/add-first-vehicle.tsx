import { useAuth } from "@context/AuthContext";
import { useTheme } from "@context/ThemeContext";
import { track } from "@lib/track";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";

export default function AddFirstVehicle() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuth();
  const isMechanic = user?.role === "MECHANIC";
  const role = isMechanic ? "MECHANIC" : "DIYER";
  const tap = (action: string) => track("first_vehicle_tap", { role, action });
  useEffect(() => { track("first_vehicle_view", { role }); }, []);

  // Once the backend confirms onboarding is complete (vehicle added for a
  // DIYer, or verification submitted for a mechanic), move on automatically
  // instead of leaving the user stuck here. DIYers go straight to Diagnose
  // with their new vehicle picked (1.0.31: users who run a diagnosis come
  // back; users who only add a vehicle mostly don't). Mechanics go to Feed.
  useEffect(() => {
    if (user?.hasCompletedOnboarding) {
      router.replace(isMechanic ? "/(tabs)/feed" : "/(tabs)/diagnose");
    }
  }, [user?.hasCompletedOnboarding]);

  if (isMechanic) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 30 }}>
        <Text style={{ fontSize: 64, marginBottom: 24 }}>🏁</Text>
        <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>
          Welcome{user?.name ? `, ${user.name}` : ""}!
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
          Get verified to earn the badge, show up on the Near Me map, and start landing job requests from drivers nearby.
        </Text>

        <TouchableOpacity
          onPress={() => { tap("get_verified"); router.push("/(tabs)/mechanic/verify"); }}
          style={{ backgroundColor: colors.blue, paddingVertical: 16, borderRadius: 14, alignItems: "center", width: "100%", marginBottom: 12 }}
        >
          <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>⭐ Get Verified</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => { tap("browse_jobs"); router.replace("/(tabs)/mechanic/jobs"); }}
          style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingVertical: 16, borderRadius: 14, alignItems: "center", width: "100%", marginBottom: 20 }}
        >
          <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>📍 Browse Jobs Near Me</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { tap("add_vehicle"); router.push("/(tabs)/(profile)/vehicles/add"); }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Add a vehicle instead</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { tap("skip"); router.replace("/(tabs)/feed"); }} style={{ paddingVertical: 10, marginTop: 16 }}>
          <Text style={{ color: colors.textMuted, fontSize: 14 }}>Skip for now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: "center", alignItems: "center", padding: 30 }}>
      <Text style={{ fontSize: 64, marginBottom: 24 }}>🚗</Text>
      <Text style={{ color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>
        Welcome{user?.name ? `, ${user.name}` : ""}!
      </Text>
      <Text style={{ color: colors.textSecondary, fontSize: 15, textAlign: "center", lineHeight: 24, marginBottom: 32 }}>
        Add your first vehicle to unlock AI diagnostics, service logs, and everything else AutoAI can do for your ride.
      </Text>

      <TouchableOpacity
        onPress={() => { tap("add_vehicle"); router.push("/(tabs)/(profile)/vehicles/add"); }}
        style={{ backgroundColor: colors.blue, paddingVertical: 16, borderRadius: 14, alignItems: "center", width: "100%", marginBottom: 12 }}
      >
        <Text style={{ color: "white", fontSize: 17, fontWeight: "700" }}>🔧 Add Your First Vehicle</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => { tap("skip"); router.replace("/(tabs)/feed"); }} style={{ paddingVertical: 10 }}>
        <Text style={{ color: colors.textMuted, fontSize: 14 }}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );
}
