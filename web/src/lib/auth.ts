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
  token?: string;
  user?: AuthUser;
  mustChangePassword?: boolean;
  /** Şifre doğru ama hesapta 2FA etkinse token yerine bu döner (bkz.
   * docs/NEW_FEATURES_TOUR.md Bölüm D). */
  twoFactorRequired?: boolean;
  preToken?: string;
}

export type LoginResult =
  | (AuthUser & { mustChangePassword: boolean; twoFactorRequired?: false })
  | { twoFactorRequired: true; preToken: string };

const TOKEN_KEY = "token";
const USER_KEY = "user";
const MUST_CHANGE_PASSWORD_KEY = "mustChangePassword";
/** OWNER'ın orijinal (impersonate öncesi) token'ı — "Çık" ile geri dönmek için. */
const IMPERSONATION_OWNER_TOKEN_KEY = "impersonationOwnerToken";
const IMPERSONATION_OWNER_USER_KEY = "impersonationOwnerUser";
const IMPERSONATION_META_KEY = "impersonationMeta";

function persistSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  // Mirrored into a cookie so the server-side middleware can check auth state.
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}`;
}

export async function login(email: string, password: string, recaptchaToken?: string): Promise<LoginResult> {
  const data = await api.post<LoginResponse>("/auth/login", { email, password, recaptchaToken });
  if (data.twoFactorRequired && data.preToken) {
    return { twoFactorRequired: true, preToken: data.preToken };
  }
  persistSession(data.token!, data.user!);
  if (data.mustChangePassword) {
    window.localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, "1");
  } else {
    window.localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  }
  return { ...data.user!, mustChangePassword: !!data.mustChangePassword };
}

/** /auth/login "twoFactorRequired" döndüğünde ikinci adım — authenticator
 * kodu veya kurtarma kodu ile gerçek oturumu açar. */
export async function verifyTwoFactorLogin(
  preToken: string,
  options: { code?: string; recoveryCode?: string }
): Promise<AuthUser & { mustChangePassword: boolean }> {
  const data = await api.post<LoginResponse>("/auth/2fa/verify", { preToken, ...options });
  persistSession(data.token!, data.user!);
  if (data.mustChangePassword) {
    window.localStorage.setItem(MUST_CHANGE_PASSWORD_KEY, "1");
  } else {
    window.localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  }
  return { ...data.user!, mustChangePassword: !!data.mustChangePassword };
}

export function mustChangePassword(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(MUST_CHANGE_PASSWORD_KEY) === "1";
}

export function clearMustChangePassword() {
  window.localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
}

/** /auth/change-password başarılı olunca dönen taze token'ı oturuma yazar. */
export function persistChangedPasswordSession(token: string, user: AuthUser) {
  persistSession(token, user);
  clearMustChangePassword();
}

export function logout(options?: { redirect?: boolean }) {
  // Best-effort: mark the server-side session as ended, but never block the
  // client-side cleanup on it — a slow/failed request shouldn't delay logout.
  api.post("/auth/logout").catch(() => {});

  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(MUST_CHANGE_PASSWORD_KEY);
  window.localStorage.removeItem(IMPERSONATION_OWNER_TOKEN_KEY);
  window.localStorage.removeItem(IMPERSONATION_OWNER_USER_KEY);
  window.localStorage.removeItem(IMPERSONATION_META_KEY);
  document.cookie = "token=; path=/; max-age=0";
  if (options?.redirect !== false) {
    window.location.href = "/giris";
  }
}

export interface ImpersonationMeta {
  sessionId: string;
  reason: string;
  targetFullName: string;
}

export function getImpersonationMeta(): ImpersonationMeta | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(IMPERSONATION_META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ImpersonationMeta;
  } catch {
    return null;
  }
}

/** OWNER'ın kendi token'ını saklayıp hedef kullanıcının token'ına geçer. */
export function beginImpersonation(token: string, user: AuthUser, meta: ImpersonationMeta) {
  const ownerToken = window.localStorage.getItem(TOKEN_KEY);
  const ownerUser = window.localStorage.getItem(USER_KEY);
  if (ownerToken) window.localStorage.setItem(IMPERSONATION_OWNER_TOKEN_KEY, ownerToken);
  if (ownerUser) window.localStorage.setItem(IMPERSONATION_OWNER_USER_KEY, ownerUser);
  window.localStorage.setItem(IMPERSONATION_META_KEY, JSON.stringify(meta));
  persistSession(token, user);
}

/** Sunucu tarafında oturumu sonlandırdıktan SONRA çağrılmalı — OWNER'ın kendi token'ına geri döner. */
export function restoreOwnerSession() {
  const ownerToken = window.localStorage.getItem(IMPERSONATION_OWNER_TOKEN_KEY);
  const ownerUserRaw = window.localStorage.getItem(IMPERSONATION_OWNER_USER_KEY);
  window.localStorage.removeItem(IMPERSONATION_OWNER_TOKEN_KEY);
  window.localStorage.removeItem(IMPERSONATION_OWNER_USER_KEY);
  window.localStorage.removeItem(IMPERSONATION_META_KEY);
  if (ownerToken && ownerUserRaw) {
    persistSession(ownerToken, JSON.parse(ownerUserRaw) as AuthUser);
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
