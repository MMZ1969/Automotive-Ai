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
  response => response,
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