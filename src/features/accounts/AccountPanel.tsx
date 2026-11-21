import { useEffect, useState, type FormEvent } from "react";

const apiBase = __API_BASE_URL__.replace(/\/$/, "");
type Profile = { display_name: string; friend_code: string };
type Friend = { display_name: string; friend_code: string; pet_name: string };

export default function AccountPanel() {
  const [token, setToken] = useState(() => localStorage.getItem("gencity.token") ?? "");
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendCode, setFriendCode] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function api<T,>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${apiBase}/api${path}`, { ...init, headers: { ...(init.headers ?? {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const data = await response.json() as T & { error?: string };
    if (!response.ok) throw new Error(data.error ?? "The profile service could not complete that request.");
    return data;
  }

  async function loadProfile(currentToken: string) {
    const response = await fetch(`${apiBase}/api/me`, { headers: { Authorization: `Bearer ${currentToken}` } });
    if (!response.ok) { localStorage.removeItem("gencity.token"); setToken(""); return; }
    const data = await response.json() as { profile: Profile };
    setProfile(data.profile);
    const friendData = await fetch(`${apiBase}/api/friends`, { headers: { Authorization: `Bearer ${currentToken}` } });
    if (friendData.ok) setFriends((await friendData.json() as { friends: Friend[] }).friends);
  }

  useEffect(() => { if (token) void loadProfile(token).catch((error: unknown) => setStatus(error instanceof Error ? error.message : "Couldn't load profile.")); }, [token]);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await fetch(`${apiBase}/api/users`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ display_name: name }) });
      const data = await response.json() as { token?: string; error?: string };
      if (!response.ok || !data.token) throw new Error(data.error ?? "Couldn't create profile.");
      localStorage.setItem("gencity.token", data.token); setToken(data.token); setStatus("Profile ready. Share your friend code to pair up.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Couldn't create profile."); }
  }

  async function addFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try { await api("/friends", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friend_code: friendCode }) }); setFriendCode(""); await loadProfile(token); setStatus("Friend added. You can message each other now."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Couldn't add friend."); }
  }

  async function sendMessage(friend: Friend) {
    try { await api("/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ friend_code: friend.friend_code, body: message }) }); setMessage(""); setStatus(`Message sent to ${friend.pet_name}.`); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Couldn't send message."); }
  }

  return <section className="content-card"><p className="eyebrow">YOUR SPACE</p><h2>Profile and friends</h2><p className="muted">Create one companion profile to use Rover and friend codes across your devices.</p>{!token ? <form className="add-task-form" onSubmit={create}><input required maxLength={24} value={name} onChange={event => setName(event.target.value)} placeholder="Your name" aria-label="Your name"/><button className="primary-button">Create profile</button></form> : profile && <><div className="placeholder-note">Your friend code: <strong>{profile.friend_code}</strong></div><form className="add-task-form" onSubmit={addFriend}><input required maxLength={8} value={friendCode} onChange={event => setFriendCode(event.target.value)} placeholder="Friend code" aria-label="Friend code"/><button className="primary-button">Add friend</button></form><ul className="task-list">{friends.map(friend => <li className="task-row" key={friend.friend_code}><span>{friend.pet_name} · {friend.display_name}</span><button className="text-button" disabled={!message.trim()} onClick={() => void sendMessage(friend)}>Send message</button></li>)}</ul>{friends.length > 0 && <input className="profile-message" value={message} maxLength={500} onChange={event => setMessage(event.target.value)} placeholder="Write a message…" aria-label="Message to friend"/>}<button className="text-button" onClick={() => { localStorage.removeItem("gencity.token"); setToken(""); setProfile(null); }}>Sign out</button></>}{status && <p className="chat-note" role="status">{status}</p>}</section>;
}
