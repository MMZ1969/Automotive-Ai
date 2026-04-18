import api from "@lib/api";

export async function fetchVehicles() {
  try {
    const res = await api.get("/api/vehicles");
    return res.data;
  } catch (err) {
    console.error("fetchVehicles error:", err);
    return [];
  }
}

export async function fetchVehicleById(id: string) {
  try {
    const res = await api.get(`/api/vehicles/${id}`);
    return res.data;
  } catch (err) {
    console.error("fetchVehicleById error:", err);
    return null;
  }
}

export async function createVehicle(data: any) {
  try {
    const res = await api.post("/api/vehicles", data);
    return res.data;
  } catch (err) {
    console.error("createVehicle error:", err);
    throw err;
  }
}