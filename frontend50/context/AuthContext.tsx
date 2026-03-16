import { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (email, password) => {
    // TODO: integrate backend
    setUser({ email });
  };

  const logout = () => {
    setUser(null);
  };

  const register = (name, email, password) => {
    // TODO: integrate backend
    setUser({ name, email });
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}