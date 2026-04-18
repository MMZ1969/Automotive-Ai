import { AuthProvider, useAuth } from "@context/AuthContext";
import { LogProvider } from "@context/LogContext";
import { VehicleProvider } from "@context/VehicleContext";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";

function RouteGuard() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!user && !inAuthGroup) {
      // Not logged in, send to login
      router.replace("/(auth)/welcome");
    } else if (user && inAuthGroup) {
      // Logged in but on auth screen, send to dashboard
      if (user.role === "MECHANIC") {
        router.replace("/(tabs)/mechanic");
      } else {
        router.replace("/(tabs)/diyer");
      }
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