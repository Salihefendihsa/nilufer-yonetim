import { api } from "./api";

export type Role = "OWNER" | "MANAGER" | "TEAM_LEAD" | "STAFF" | "CUSTOMER";

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "İşletme Sahibi",
  MANAGER: "Müdür",
  TEAM_LEAD: "Ekip Lideri",
  STAFF: "Personel",
  CUSTOMER: "Müşteri",
};

/** Short forms used for panel headers, e.g. "Patron Paneli". */
export const ROLE_SHORT_LABELS: Record<Role, string> = {
  OWNER: "Patron",
  MANAGER: "Müdür",
  TEAM_LEAD: "Şef",
  STAFF: "Personel",
  CUSTOMER: "Müşteri",
};

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

interface LoginResponse {
  token: string;
  user: AuthUser;
}

const TOKEN_KEY = "token";
const USER_KEY = "user";

function persistSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Mirrored into a cookie so the server-side middleware can check auth state.
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`;
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const data = await api.post<LoginResponse>("/auth/login", { email, password });
  persistSession(data.token, data.user);
  return data.user;
}

export function logout(options?: { redirect?: boolean }) {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  document.cookie = "token=; path=/; max-age=0";
  if (options?.redirect !== false) {
    window.location.href = "/giris";
  }
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
