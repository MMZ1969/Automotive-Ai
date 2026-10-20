import { AuthProvider, useAuth } from "@context/AuthContext";
import { LogProvider } from "@context/LogContext";
import { ThemeProvider } from "@context/ThemeContext";
import { VehicleProvider } from "@context/VehicleContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

const PUBLIC_ROUTES = ["forgot-password", "reset-password", "change-password", "guidelines"];

function BannedScreen() {
  const { logout } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: "#050509", justifyContent: "center", alignItems: "center", padding: 40 }}>
      <Text style={{ fontSize: 48, marginBottom: 16 }}>🚫</Text>
      <Text style={{ color: "white", fontSize: 22, fontWeight: "900", textAlign: "center", marginBottom: 12 }}>
        Account Suspended
      </Text>
      <Text style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", marginBottom: 32 }}>
        Your AutoAI account has been suspended for violating our community guidelines. If you believe this is a mistake, contact support at maz@amazmade.com.
      </Text>
      <TouchableOpacity onPress={logout} style={{ backgroundColor: "#345bff", paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 }}>
        <Text style={{ color: "white", fontWeight: "700" }}>Log Out</Text>
      </TouchableOpacity>
    </View>
  );
}

function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

  // Push taps. Covers both a running app and a cold start from the
  // notification. Reminder pushes carry { type: "REMINDER", vehicleId } and
  // open that vehicle; waits until the session is restored so the route
  // guard doesn't bounce it to Welcome.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledPush = useRef<string | null>(null);
  useEffect(() => {
    if (!lastResponse || loading || !user) return;
    const pushId = lastResponse.notification.request.identifier;
    if (handledPush.current === pushId) return;
    handledPush.current = pushId;
    const data: any = lastResponse.notification.request.content.data || {};
    if (data.type === "REMINDER" && data.vehicleId) {
      router.push(`/(tabs)/(profile)/vehicles/${data.vehicleId}`);
    }
  }, [lastResponse, loading, user]);

  useEffect(() => {
    const checkOnboarding = async () => {
      const seen = await AsyncStorage.getItem("hasSeenOnboarding");
      setHasSeenOnboarding(!!seen);
      setOnboardingChecked(true);
    };
    checkOnboarding();
  }, []);

  useEffect(() => {
    if (loading || !onboardingChecked) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inPublicRoute = PUBLIC_ROUTES.includes(segments[0]);
    const inOnboarding = segments[0] === "onboarding";

    // First time user — show onboarding. Public routes (forgot/reset password,
    // guidelines) are exempt, otherwise "Forgot password" bounced to onboarding
    // and then Welcome on any phone without the hasSeenOnboarding flag.
    if (!hasSeenOnboarding && !inOnboarding && !inAuthGroup && !inPublicRoute && !user) {
      router.replace("/onboarding");
      return;
    }

    if (!user && !inAuthGroup && !inPublicRoute && !inOnboarding) {
      router.replace("/(auth)/welcome");
    } else if (user && inAuthGroup) {
      router.replace(user.hasCompletedOnboarding ? "/(tabs)/feed" : "/add-first-vehicle");
    }
  }, [user, loading, segments, onboardingChecked, hasSeenOnboarding]);

  if (user?.isBanned) {
    return <BannedScreen />;
  }

  return <Slot />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <VehicleProvider>
          <LogProvider>
            <RouteGuard />
          </LogProvider>
        </VehicleProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}