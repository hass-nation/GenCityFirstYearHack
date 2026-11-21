export const identityKey = "gencity-friends-token";
export type FriendMessage = { id: number; sender_name: string; body: string };

export async function messagingRequest<T>(path: string, token?: string, body?: object, signal?: AbortSignal): Promise<T> {
  const headers = new Headers();
  if (token) headers.set("X-PC-Pet-Token", token);
  if (body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { method: body ? "POST" : "GET", headers, body: body && JSON.stringify(body),
    cache: "no-store", signal: AbortSignal.any([AbortSignal.timeout(8000), ...(signal ? [signal] : [])]) });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error ?? "Messaging needs a connection to the local demo server.");
  return data;
}
