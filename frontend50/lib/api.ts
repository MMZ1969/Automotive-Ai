import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { DeviceEventEmitter } from "react-native";

const api = axios.create({
  baseURL: "https://automotive-ai-production.up.railway.app",
  headers: {
    "Content-Type": "application/json",
  },
});

let isLoggingOut = false;

// Auto logout on expired token
api.interceptors.response.use(
  response => {
    // Sliding session: the server re-issues a fresh 90-day token on requests
    // made with a token older than a day. Save it so regular users never get
    // logged out; anyone gone 90+ days just logs in again.
    const fresh = response.headers?.["x-refreshed-token"];
    if (typeof fresh === "string" && fresh.length > 20 && !isLoggingOut) {
      api.defaults.headers.common["Authorization"] = `Bearer ${fresh}`;
      AsyncStorage.setItem("token", fresh).catch(() => {});
    }
    return response;
  },
  async error => {
    if (error.response?.status === 401 && !isLoggingOut) {
      isLoggingOut = true;
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      delete api.defaults.headers.common["Authorization"];
      DeviceEventEmitter.emit("session-expired");
      // Reset shortly after so a genuinely new login can trigger this again later
      setTimeout(() => {
        isLoggingOut = false;
      }, 2000);
    }
    return Promise.reject(error);
  }
);

export default api;