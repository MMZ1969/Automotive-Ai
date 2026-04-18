import { fetchVehicles } from "@lib/vehicles";
import React, { createContext, useContext, useState } from "react";

interface VehicleContextType {
  vehicles: any[];
  loading: boolean;
  setVehicles: (v: any[]) => void;
  setLoading: (v: boolean) => void;
  refreshVehicles: () => Promise<void>;
}

const VehicleContext = createContext<VehicleContextType | null>(null);

export const VehicleProvider = ({ children }: { children: React.ReactNode }) => {
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshVehicles = async () =>
    {
      setLoading(true);
      try {
        const data = await fetchVehicles();
        setVehicles(data || []);
      } catch (err) {
        console.error("refreshVehicles error:", err);
      } finally {
        setLoading(false);
      }
    };

  return (
    <VehicleContext.Provider
      value={{
        vehicles,
        loading,
        setVehicles,
        setLoading,
        refreshVehicles,
      }}
    >
      {children}
    </VehicleContext.Provider>
  );
};

export const useVehicle = () => {
  const ctx = useContext(VehicleContext);
  if (!ctx) throw new Error("useVehicle must be used inside VehicleProvider");
  return ctx;
};