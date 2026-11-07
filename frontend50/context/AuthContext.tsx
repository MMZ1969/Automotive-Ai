import api from "@lib/api";
import { forgetPushSync, syncPushToken } from "@lib/push";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AppState, DeviceEventEmitter } from "react-native";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  completeVerification: (token: string, userObj: any) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isMechanic: boolean;
  isDIYer: boolean;
  updateProfilePhoto: (url: string) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  switchRole: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// ─── PUSH TOKEN ───────────────────────────────────────────────────────────────
// Login/launch never show the notification prompt anymore (see lib/push.ts):
// they only send the token when permission is already granted. The app asks
// at useful moments instead (question posted, reminder set, diagnosis card).

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
        // Back from Settings with notifications newly on: send the token.
        // (No-op when not granted, logged out, or sent in the last 7 days.)
        AsyncStorage.getItem("token").then((t) => { if (t) syncPushToken(); });
      }
    });

    return () => sub.remove();
  }, []);

  // ─── SESSION EXPIRED LISTENER ───────────────────────────────────────────
  // Fired once by the api.ts interceptor when any request 401s. This is the
  // single source of truth for logging the user out and redirecting — avoids
  // every in-flight request (notif poll, message poll, etc.) independently
  // clearing storage and logging duplicate errors.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener("session-expired", () => {
      setUser(null);
      router.replace("/(auth)/login");
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
            syncPushToken();
          } catch (err) {
            // 401 is now handled globally by the interceptor + session-expired
            // listener above. Any other error here (network blip, etc.) just
            // leaves the cached user in place.
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
      syncPushToken(true);
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
      syncPushToken(true);
    } catch (err) {
      console.error("AUTH REGISTER ERROR:", err);
      throw err;
    }
  };

  // Called after a successful verify-email code check. That endpoint
  // already returns a fresh token + user (same shape as /login) — this
  // just applies it the same way login() does, so a user who just fought
  // their way through the code screen lands straight in the app instead
  // of being sent back to re-type the password they just used.
  const completeVerification = async (token: string, userObj: any) => {
    await AsyncStorage.setItem("token", token);
    await AsyncStorage.setItem("user", JSON.stringify(userObj));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    setUser(userObj);
    syncPushToken(true);
  };

  const logout = async () => {
    try {
      await AsyncStorage.multiRemove(["token", "user"]);
      await forgetPushSync(); // next account on this device re-sends the token
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
        completeVerification,
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