import api from "@lib/api";

export async function fetchAllLogs() {
  try {
    const res = await api.get("/api/logs");
    return res.data;
  } catch (err) {
    console.error("fetchAllLogs error:", err);
    return [];
  }
}

export async function fetchLogsByVehicle(vehicleId: string) {
  try {
    const res = await api.get(`/api/logs/vehicle/${vehicleId}`);
    return res.data;
  } catch (err) {
    console.error("fetchLogsByVehicle error:", err);
    return [];
  }
}

export async function fetchLogById(vehicleId: string, logId: string) {
  try {
    const res = await api.get(`/api/logs/vehicle/${vehicleId}/${logId}`);
    return res.data;
  } catch (err) {
    console.error("fetchLogById error:", err);
    return null;
  }
}

export async function createLog(vehicleId: string, data: any) {
  try {
    const res = await api.post(`/api/logs/vehicle/${vehicleId}`, data);
    return res.data;
  } catch (err) {
    console.error("createLog error:", err);
    throw err;
  }
}

export async function updateLog(vehicleId: string, logId: string, data: any) {
  try {
    const res = await api.put(`/api/logs/vehicle/${vehicleId}/${logId}`, data);
    return res.data;
  } catch (err) {
    console.error("updateLog error:", err);
    throw err;
  }
}

export async function deleteLog(vehicleId: string, logId: string) {
  try {
    await api.delete(`/api/logs/vehicle/${vehicleId}/${logId}`);
  } catch (err) {
    console.error("deleteLog error:", err);
    throw err;
  }
}