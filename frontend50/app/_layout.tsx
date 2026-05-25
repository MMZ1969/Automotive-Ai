import { AuthProvider, useAuth } from "@context/AuthContext";
import { LogProvider } from "@context/LogContext";
import { ThemeProvider } from "@context/ThemeContext";
import { VehicleProvider } from "@context/VehicleContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect, useState } from "react";

const PUBLIC_ROUTES = ["forgot-password", "reset-password", "change-password", "guidelines"];

function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(false);

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

    // First time user — show onboarding
    if (!hasSeenOnboarding && !inOnboarding && !inAuthGroup && !user) {
      router.replace("/onboarding");
      return;
    }

    if (!user && !inAuthGroup && !inPublicRoute && !inOnboarding) {
      router.replace("/(auth)/welcome");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/feed");
    }
  }, [user, loading, segments, onboardingChecked, hasSeenOnboarding]);

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