import { apiRequest } from "./api";

export async function fetchLogs() {
  return apiRequest("/logs", { method: "GET" });
}

export async function createLog(log: any) {
  return apiRequest("/logs", {
    method: "POST",
    body: JSON.stringify(log),
  });
}

export async function deleteLog(id: string) {
  return apiRequest(`/logs/${id}`, { method: "DELETE" });
}