import { createContext, useContext, useState } from "react";

const LogContext = createContext(null);

export function LogProvider({ children }) {
  const [logs, setLogs] = useState([]);

  const addLog = (log) => {
    setLogs((prev) => [...prev, log]);
  };

  const removeLog = (id) => {
    setLogs((prev) => prev.filter((l) => l.id !== id));
  };

  return (
    <LogContext.Provider value={{ logs, addLog, removeLog }}>
      {children}
    </LogContext.Provider>
  );
}

export function useLogs() {
  return useContext(LogContext);
}