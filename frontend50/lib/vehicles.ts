import { apiRequest } from "./api";

export async function fetchVehicles() {
  return apiRequest("/vehicles", { method: "GET" });
}

export async function createVehicle(vehicle: any) {
  return apiRequest("/vehicles", {
    method: "POST",
    body: JSON.stringify(vehicle),
  });
}

export async function deleteVehicle(id: string) {
  return apiRequest(`/vehicles/${id}`, { method: "DELETE" });
}