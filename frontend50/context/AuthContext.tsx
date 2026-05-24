import api from "@lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import React, { createContext, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  isMechanic: boolean;
  isDIYer: boolean;
  updateProfilePhoto: (url: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  switchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── PUSH TOKEN HELPER ────────────────────────────────────────────────────────
// Gets the device's Expo push token and saves it to the backend
const registerPushToken = async () => {
  try {
    if (!Device.isDevice) return; // Push doesn't work in simulators

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") return; // User denied permission

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    // Save to backend
    await api.put("/api/users/me", { pushToken });

    // Android needs a notification channel
    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
  } catch (err) {
    console.error("PUSH TOKEN ERROR:", err);
    // Never crash the app if push setup fails
  }
};

// ─── PROVIDER ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
            // Re-register push token on session restore too
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
      // Register push token after login
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
