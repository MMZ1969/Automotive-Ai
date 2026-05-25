import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

const api = axios.create({
  baseURL: "https://automotive-ai-production.up.railway.app",
  headers: {
    "Content-Type": "application/json",
  },
});

// Auto logout on expired token
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
      delete api.defaults.headers.common["Authorization"];
    }
    return Promise.reject(error);
  }
);

export default api;