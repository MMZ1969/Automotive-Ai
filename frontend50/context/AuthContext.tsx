import api from "@lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, Platform } from "react-native";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isMechanic: boolean;
  isDIYer: boolean;
  updateProfilePhoto: (url: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  switchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── PUSH TOKEN HELPER ────────────────────────────────────────────────────────
const registerPushToken = async () => {
  try {
    if (!Device.isDevice) return;

    // Android needs a channel set up before tokens/notifications behave.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.log("PUSH: permission not granted, skipping token registration");
      return;
    }

    // ── THE FIX ──
    // getExpoPushTokenAsync() needs the EAS projectId on real store builds.
    // Without it, it throws on device builds and the token is never saved
    // (which is exactly why every user had a null pushToken). Pull it from
    // app config, with a hardcoded fallback so it can never be undefined.
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      (Constants as any)?.easConfig?.projectId ??
      "6f942beb-c59e-4d1a-b4b0-8317a2566f21";

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenData.data;

    console.log("PUSH: got token", pushToken);

    await api.put("/api/users/me", { pushToken });

    console.log("PUSH: token saved to backend");
  } catch (err) {
    console.error("PUSH TOKEN ERROR:", err);
  }
};

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // ─── CLEAR APP ICON BADGE ───────────────────────────────────────────────
  // The red number on the app icon is an OS-level badge, separate from the
  // in-app alerts. Push notifications set it, but nothing clears it — so it
  // gets "stuck" (e.g. a "2" with no matching alerts inside). This zeroes it
  // on launch and every time the app returns to the foreground.
  useEffect(() => {
    Notifications.setBadgeCountAsync(0);

    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        Notifications.setBadgeCountAsync(0);
      }
    });

    return () => sub.remove();
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const userData = await AsyncStorage.getItem("user");
        if (token && userData) {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          const parsed = JSON.parse(userData);
          setUser(parsed);
          try {
            const res = await api.get("/api/users/me");
            const freshUser = res.data;
            await AsyncStorage.setItem("user", JSON.stringify(freshUser));
            setUser(freshUser);
            await registerPushToken();
          } catch (err) {
            console.error("AUTH RESTORE: could not refresh user", err);
          }
        }
      } catch (err) {
        console.error("AUTH RESTORE ERROR:", err);
      } finally {
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  // ─── REFRESH USER (re-pulls live status: verified, role, location, etc.) ───
  const refreshUser = async () => {
    try {
      const res = await api.get("/api/users/me");
      const freshUser = res.data;
      if (freshUser) {
        await AsyncStorage.setItem("user", JSON.stringify(freshUser));
        setUser(freshUser);
      }
    } catch (err) {
      console.error("AUTH: refreshUser failed", err);
    }
  };

  const login = async (email: string, password: string) => {
    delete api.defaults.headers.common["Authorization"];
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const token = res.data.token;
      const userObj = res.data.user;
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("user", JSON.stringify(userObj));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser(userObj);
      await registerPushToken();
    } catch (err) {
      console.error("AUTH LOGIN ERROR:", err);
      throw err;
    }
  };

  const register = async (data: any) => {
    try {
      const res = await api.post("/api/auth/register", data);
      if (res.data.needsVerification) {
        const error: any = new Error("Verification required");
        error.needsVerification = true;
        throw error;
      }
      const token = res.data.token;
      const userObj = res.data.user;
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("user", JSON.stringify(userObj));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser(userObj);
      await registerPushToken();
    } catch (err) {
      console.error("AUTH REGISTER ERROR:", err);
      throw err;
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(["token", "user"]);
      delete api.defaults.headers.common["Authorization"];
      setUser(null);
    } catch (err) {
      console.error("AUTH LOGOUT ERROR:", err);
    }
  };

  const updateProfilePhoto = async (url: string) => {
    try {
      const res = await api.put("/api/users/me", { profilePhoto: url });
      const updatedUser = { ...user, ...res.data, profilePhoto: url };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      console.error("AUTH: failed to update profile photo", err);
      throw err;
    }
  };

  const updateName = async (name: string) => {
    try {
      await api.put("/api/users/me", { name });
      const updatedUser = { ...user, name };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      console.error("AUTH: failed to update name", err);
      throw err;
    }
  };

  const switchRole = async () => {
    try {
      const newRole = user?.role === "MECHANIC" ? "DIYER" : "MECHANIC";
      await api.put("/api/users/me", { role: newRole });
      const updatedUser = { ...user, role: newRole };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    } catch (err) {
      console.error("AUTH: failed to switch role", err);
      throw err;
    }
  };

  const isMechanic = user?.role === "MECHANIC";
  const isDIYer = user?.role === "DIYER";

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
        refreshUser,
        isMechanic,
        isDIYer,
        updateProfilePhoto,
        updateName,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
