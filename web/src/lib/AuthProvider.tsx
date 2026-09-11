"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentUser, logout as logoutSession, mustChangePassword, type AuthUser } from "./auth";
import { api } from "./api";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: logoutSession,
});

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getCurrentUser());
    setLoading(false);

    // Backend zaten mustChangePassword=true iken bu ekran/temel auth uçları
    // dışında her isteği 403'ler (bkz. middleware/auth.ts) — bu yalnızca
    // istemci tarafında doğrudan başka bir sayfaya gitmeyi engelleyen bir
    // rahatlık katmanı.
    if (mustChangePassword() && window.location.pathname !== "/sifre-degistir-zorunlu") {
      window.location.href = "/sifre-degistir-zorunlu";
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    // Lightweight "is this user actually still around" signal — stops the moment
    // the tab closes, so lastActiveAt reflects real activity, not just token validity.
    const interval = setInterval(() => {
      api.post("/auth/heartbeat").catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, logout: logoutSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
