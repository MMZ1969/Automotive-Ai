import api from "./api";

// LOGIN
export async function loginRequest(email: string, password: string) {
  return api.post("/api/auth/login", { email, password });
}

// REGISTER
export async function registerRequest(
  name: string,
  email: string,
  password: string
) {
  return api.post("/api/auth/register", { name, email, password });
}

// LOGOUT
export async function logoutRequest() {
  return api.post("/api/auth/logout");
}