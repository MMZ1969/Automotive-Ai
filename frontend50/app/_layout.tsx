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