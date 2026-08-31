export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Backend returns upload paths as relative URLs (e.g. "/uploads/x.png") — resolve against the API origin. */
export function resolveUploadUrl(url: string): string {
  if (/^https?:\/\//.test(url)) return url;
  return `${API_URL}${url}`;
}

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("token");
}

function handleUnauthorized() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("user");
  document.cookie = "token=; path=/; max-age=0";
  window.location.href = "/giris";
}

// A 401 from these endpoints means "wrong credentials", not "your session expired" —
// there is no session yet to expire. Treating it as one hid the real error (e.g. "E-posta
// veya şifre hatalı") behind a generic "Oturum sona erdi" and force-redirected the user
// back to the login page they were already on.
const PRE_SESSION_PATHS = ["/auth/login", "/auth/register"];

function isPreSessionCall(path: string): boolean {
  return PRE_SESSION_PATHS.some((p) => path.startsWith(p));
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !isPreSessionCall(path)) {
    handleUnauthorized();
    throw new ApiError(401, "Oturum sona erdi");
  }

  if (res.status === 204) {
    return undefined as T;
  }

  const data = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Bir hata oluştu", data?.details);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

export async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { method: "POST", headers, body: formData });

  if (res.status === 401 && !isPreSessionCall(path)) {
    handleUnauthorized();
    throw new ApiError(401, "Oturum sona erdi");
  }

  const data = await res.json().catch(() => undefined);

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? "Bir hata oluştu", data?.details);
  }

  return data as T;
}

export async function downloadFile(path: string, filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { headers });

  if (res.status === 401) {
    handleUnauthorized();
    throw new ApiError(401, "Oturum sona erdi");
  }

  if (!res.ok) {
    throw new ApiError(res.status, "Dosya indirilemedi");
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
