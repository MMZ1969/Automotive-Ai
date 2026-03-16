import { apiRequest } from "./api";

export async function loginRequest(email: string, password: string) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function registerRequest(name: string, email: string, password: string) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

export async function logoutRequest() {
  return apiRequest("/auth/logout", { method: "POST" });
}