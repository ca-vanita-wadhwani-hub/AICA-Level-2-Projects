import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken } from "../lib/api.js";

export type Role =
  | "admin"
  | "finance_manager"
  | "accounts"
  | "procurement_manager"
  | "operations_manager"
  | "warehouse_manager"
  | "plant_engineer";

export interface AuthUser {
  id: number;
  username: string;
  role: Role;
  fullName: string;
}

type PermissionLevel = "none" | "read" | "write";

interface AuthContextValue {
  user: AuthUser | null;
  permissions: Record<string, PermissionLevel>;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  can: (module: string, level?: PermissionLevel) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [permissions, setPermissions] = useState<Record<string, PermissionLevel>>({});
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    try {
      const me = await api<{ user: AuthUser }>("/auth/me");
      setUser(me.user);
      const perms = await api<{ permissions: Record<string, PermissionLevel> }>("/permissions/me");
      setPermissions(perms.permissions);
    } catch {
      setUser(null);
      setPermissions({});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (username: string, password: string) => {
    const result = await api<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: { username, password },
    });
    setToken(result.token);
    setUser(result.user);
    const perms = await api<{ permissions: Record<string, PermissionLevel> }>("/permissions/me");
    setPermissions(perms.permissions);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      setToken(null);
      setUser(null);
      setPermissions({});
    }
  }, []);

  const can = useCallback(
    (module: string, level: PermissionLevel = "read") => {
      const granted = permissions[module];
      if (level === "read") return granted === "read" || granted === "write";
      return granted === "write";
    },
    [permissions],
  );

  const value = useMemo(
    () => ({ user, permissions, loading, login, logout, can }),
    [user, permissions, loading, login, logout, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
