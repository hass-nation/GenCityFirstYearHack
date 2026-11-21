export type AccountProfile = {
  id: string;
  display_name: string;
  friend_code: string;
  pet_name: string;
  pet_avatar: string;
  pet_theme: string;
};

declare const __API_BASE_URL__: string;
export const ACCOUNT_TOKEN_KEY = "gencity-companion-token";
const apiBase = __API_BASE_URL__.replace(/\/$/, "");

type ApiError = { error?: string };

export class AccountApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AccountApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`${apiBase}/api${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const data = response.status === 204 ? undefined : await response.json().catch(() => ({})) as ApiError;
  if (!response.ok) throw new AccountApiError(data?.error ?? `The server returned ${response.status}.`, response.status);
  return data as T;
}

export async function createAccount(displayName: string, email: string, password: string) {
  return request<{ token: string; profile: AccountProfile }>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName, email, password }),
  });
}

export async function signIn(email: string, password: string) {
  return request<{ token: string; profile: AccountProfile }>("/auth/signin", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getAccountProfile(token: string) {
  return request<{ profile: AccountProfile }>("/me", {}, token);
}

export function updateAccountPet(token: string, pet: { pet_name: string; pet_avatar: string; pet_theme: string }) {
  return request<{ profile: AccountProfile }>("/me/pet", {
    method: "PATCH",
    body: JSON.stringify(pet),
  }, token);
}

export function getAccountExport(token: string) {
  return request<Record<string, unknown>>("/me/export", {}, token);
}

export function deleteAccount(token: string) {
  return request<void>("/me", { method: "DELETE" }, token);
}

export function signOut(token: string) {
  return request<void>("/auth/signout", { method: "POST" }, token);
}
