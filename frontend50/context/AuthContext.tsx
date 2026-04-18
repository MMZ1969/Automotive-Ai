import api from "@lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  isMechanic: boolean;
  isDIYer: boolean;
  updateProfilePhoto: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const restoreSession = async () => {
      try {
        console.log("AUTH RESTORE: starting restoreSession");
        const token = await AsyncStorage.getItem("token");
        const userData = await AsyncStorage.getItem("user");
        console.log("AUTH RESTORE: token from storage =", token);
        console.log("AUTH RESTORE: user from storage =", userData);
        if (token && userData) {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
          const parsed = JSON.parse(userData);
          console.log("AUTH RESTORE: parsed user =", parsed);
          setUser(parsed);
        } else {
          console.log("AUTH RESTORE: no token or user found");
        }
      } catch (err) {
        console.error("AUTH RESTORE ERROR:", err);
      } finally {
        console.log("AUTH RESTORE: finished, setting loading = false");
        setLoading(false);
      }
    };
    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    delete api.defaults.headers.common["Authorization"]; // clear old token before login
    console.log("AUTH LOGIN: starting login with", email);
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const token = res.data.token;
      const userObj = res.data.user;
      console.log("AUTH LOGIN: response token =", token);
      console.log("AUTH LOGIN: response user =", userObj);
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("user", JSON.stringify(userObj));
      console.log("AUTH LOGIN: saved token & user to AsyncStorage");
      const savedToken = await AsyncStorage.getItem("token");
      const savedUser = await AsyncStorage.getItem("user");
      console.log("AUTH LOGIN: reading back token =", savedToken);
      console.log("AUTH LOGIN: reading back user =", savedUser);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser(userObj);
      console.log("AUTH LOGIN: setUser called with", userObj);
    } catch (err) {
      console.error("AUTH LOGIN ERROR:", err);
      throw err;
    } finally {
      console.log("AUTH LOGIN: finished");
    }
  };

  const register = async (data: any) => {
    console.log("AUTH REGISTER: starting register");
    try {
      console.log("AUTH REGISTER: sending data =", data);
      const res = await api.post("/api/auth/register", data);
      const token = res.data.token;
      const userObj = res.data.user;
      console.log("AUTH REGISTER: response token =", token);
      console.log("AUTH REGISTER: response user =", userObj);
      await AsyncStorage.setItem("token", token);
      await AsyncStorage.setItem("user", JSON.stringify(userObj));
      console.log("AUTH REGISTER: saved token & user to AsyncStorage");
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setUser(userObj);
      console.log("AUTH REGISTER: setUser called with", userObj);
    } catch (err) {
      console.error("AUTH REGISTER ERROR:", err);
      throw err;
    } finally {
      console.log("AUTH REGISTER: finished");
    }
  };

  const logout = async () => {
    try {
      console.log("AUTH LOGOUT: clearing storage and user");
      await AsyncStorage.multiRemove(["token", "user"]);
      delete api.defaults.headers.common["Authorization"];
      setUser(null);
      console.log("AUTH LOGOUT: complete");
    } catch (err) {
      console.error("AUTH LOGOUT ERROR:", err);
    }
};

  const updateProfilePhoto = async (url: string) => {
    try {
      const updatedUser = { ...user, profilePhoto: url };
      await AsyncStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      console.log("AUTH: profile photo updated to", url);
    } catch (err) {
      console.error("AUTH: failed to update profile photo", err);
      throw err;
    }
  };

  const isMechanic = user?.role === "MECHANIC";
  const isDIYer = user?.role === "DIYER";

  console.log("AUTH CONTEXT RENDER:", { loading, user });

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