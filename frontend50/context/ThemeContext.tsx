import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

type ThemeMode = "dark" | "light" | "system";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  colors: typeof darkColors;
}

const darkColors = {
  background: "#050509",
  card: "#11131a",
  border: "#252838",
  text: "#ffffff",
  textSecondary: "#9ca3af",
  textMuted: "#6b7280",
  blue: "#345bff",
  blueMuted: "#1e3a8a",
  green: "#10b981",
  greenMuted: "#064e3b",
  input: "#11131a",
};

const lightColors = {
  background: "#f8f9fa",
  card: "#ffffff",
  border: "#e5e7eb",
  text: "#0a0a0a",
  textSecondary: "#4b5563",
  textMuted: "#9ca3af",
  blue: "#345bff",
  blueMuted: "#dbeafe",
  green: "#10b981",
  greenMuted: "#d1fae5",
  input: "#f3f4f6",
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    const load = async () => {
      const saved = await AsyncStorage.getItem("themeMode");
      if (saved) setThemeModeState(saved as ThemeMode);
    };
    load();
  }, []);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    await AsyncStorage.setItem("themeMode", mode);
  };

  const isDark = themeMode === "system"
    ? systemScheme === "dark"
    : themeMode === "dark";

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, setThemeMode, colors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
};