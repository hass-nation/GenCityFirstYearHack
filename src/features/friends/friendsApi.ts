export type CompanionProfile = {
  id: string;
  display_name: string;
  friend_code: string;
  pet_name: string;
  pet_avatar: string;
  pet_theme: string;
};

const tokenKey = "gencity-companion-token";

type ApiResult<T> = T & { error?: string };

async function apiRequest<T>(path: string, token?: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = await response.json().catch(() => ({})) as ApiResult<T>;
  if (!response.ok) throw new Error(result.error ?? "The request failed. Please try again.");
  return result;
}

export function savedCompanionToken(): string | null {
  return localStorage.getItem(tokenKey);
}

export function forgetCompanionToken(): void {
  localStorage.removeItem(tokenKey);
}

export async function createCompanionProfile(displayName: string): Promise<{ token: string; profile: CompanionProfile }> {
  const result = await apiRequest<{ token: string; profile: CompanionProfile }>("/users", undefined, { display_name: displayName });
  localStorage.setItem(tokenKey, result.token);
  return result;
}

export async function fetchCompanionProfile(token: string): Promise<CompanionProfile> {
  const result = await apiRequest<{ profile: CompanionProfile }>("/me", token);
  return result.profile;
}

export async function fetchFriends(token: string): Promise<CompanionProfile[]> {
  const result = await apiRequest<{ friends: CompanionProfile[] }>("/friends", token);
  return result.friends;
}

export async function joinFriendByCode(token: string, friendCode: string): Promise<void> {
  await apiRequest<{ friend: CompanionProfile }>("/friends", token, { friend_code: friendCode });
}
