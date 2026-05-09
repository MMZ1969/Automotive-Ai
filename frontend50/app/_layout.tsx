import { AuthProvider, useAuth } from "@context/AuthContext";
import { LogProvider } from "@context/LogContext";
import { VehicleProvider } from "@context/VehicleContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

const PUBLIC_ROUTES = ["forgot-password", "reset-password", "change-password"];

function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inPublicRoute = PUBLIC_ROUTES.includes(segments[0]);

    if (!user && !inAuthGroup && !inPublicRoute) {
      router.replace("/(auth)/welcome");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)/feed");
    }
  }, [user, loading, segments]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <VehicleProvider>
        <LogProvider>
          <RouteGuard />
        </LogProvider>
      </VehicleProvider>
    </AuthProvider>
  );
}