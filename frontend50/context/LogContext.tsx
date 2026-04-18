import { fetchLogsByVehicle } from "@lib/logs";
import React, { createContext, useContext, useState } from "react";

interface LogContextType {
  logs: any[];
  loading: boolean;
  setLogs: (v: any[]) => void;
  setLoading: (v: boolean) => void;
  refreshLogs: (vehicleId: string) => Promise<void>;
}

const LogContext = createContext<LogContextType | null>(null);

export const LogProvider = ({ children }: { children: React.ReactNode }) => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshLogs = async (vehicleId: string) => {
    setLoading(true);
    try {
      const data = await fetchLogsByVehicle(vehicleId);
      setLogs(data || []);
    } catch (err) {
      console.error("refreshLogs error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LogContext.Provider
      value={{
        logs,
        loading,
        setLogs,
        setLoading,
        refreshLogs,
      }}
    >
      {children}
    </LogContext.Provider>
  );
};

export const useLog = () => {
  const ctx = useContext(LogContext);
  if (!ctx) throw new Error("useLog must be used inside LogProvider");
  return ctx;
};