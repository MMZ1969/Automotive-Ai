import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { DeviceEventEmitter } from "react-native";

// Our own domain, CNAME'd to the host: moving hosts later is a DNS change,
// not an app update. The Railway URL stays as a fallback. If the custom
// domain can't be reached at all (DNS/cert trouble), the request is retried
// once against Railway and the app stays on Railway for the rest of the session.
const PRIMARY_URL = "https://api.automotiveai.app";
const FALLBACK_URL = "https://automotive-ai-production.up.railway.app";

const api = axios.create({
  baseURL: PRIMARY_URL,
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
    // No response at all (DNS failure, TLS error, host unreachable) while on
    // the custom domain → switch to Railway and retry this request once.
    const cfg = error.config;
    if (!error.response && !axios.isCancel(error) && cfg && !cfg._retriedFallback && api.defaults.baseURL === PRIMARY_URL) {
      api.defaults.baseURL = FALLBACK_URL;
      cfg._retriedFallback = true;
      cfg.baseURL = FALLBACK_URL;
      return api.request(cfg);
    }
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