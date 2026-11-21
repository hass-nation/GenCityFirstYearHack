import { useEffect, useState, type FormEvent } from "react";
import { formatScreenTime } from "../tasks/dashboardStats";
import { friendsTokenKey as tokenKey, sharingKey, type ScreenTime } from "./screenTimeSharing";

type Profile = { id: string; display_name: string; friend_code: string; pet_name: string; pet_avatar: string; share_screen_time?: boolean; screen_time?: ScreenTime };
type Member = Pick<Profile, "id" | "display_name" | "pet_avatar"> & { ready: boolean };
type Party = {
  code: string;
  host_id: string;
  status: "lobby" | "active" | "finished";
  ends_at: number | null;
  server_time: number;
  members: Member[];
};
type PartyResponse = { party: Party | null };

class FriendsError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function callApi<T>(path: string, token?: string, method = "GET", body?: object, signal?: AbortSignal): Promise<T> {
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (body) headers.set("Content-Type", "application/json");
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(`/api${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new FriendsError(data?.error ?? "Could not reach the Friends server. Check that Flask is running.", response.status);
  }
  return data;
}

function formValue(event: FormEvent<HTMLFormElement>, name: string) {
  event.preventDefault();
  return String(new FormData(event.currentTarget).get(name) ?? "").trim();
}

function formatCountdown(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function FriendsPanel({ screenTime }: { screenTime: ScreenTime }) {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? "");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [friends, setFriends] = useState<Profile[]>([]);
  const [party, setParty] = useState<Party | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [notice, setNotice] = useState("");

  function showParty(next: Party | null) {
    const receivedAt = Date.now();
    setParty(next);
    setNow(receivedAt);
    setDeadline(next?.ends_at != null ? receivedAt + next.ends_at - next.server_time : null);
  }

  useEffect(() => {
    if (!token || busy) return;
    const controller = new AbortController();
    let timer: number | undefined;

    async function refresh() {
      try {
        const [me, connections, current] = await Promise.all([
          callApi<{ profile: Profile }>("/me", token, "GET", undefined, controller.signal),
          callApi<{ friends: Profile[] }>("/friends", token, "GET", undefined, controller.signal),
          callApi<PartyResponse>("/parties/current", token, "GET", undefined, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setProfile(me.profile);
        localStorage.setItem(sharingKey, String(Boolean(me.profile.share_screen_time)));
        setFriends(connections.friends);
        showParty(current.party);
        setConnectionError("");
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof FriendsError && failure.status === 401) {
          localStorage.removeItem(tokenKey);
          setToken("");
          setProfile(null);
          setFriends([]);
          showParty(null);
          setError("This server no longer recognises your profile. Create a profile to reconnect.");
          return;
        }
        setConnectionError("Could not refresh Friends. Reconnecting…");
      }
      if (!controller.signal.aborted) timer = window.setTimeout(() => void refresh(), 3000);
    }

    void refresh();
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [token, busy]);

  useEffect(() => {
    if (party?.status !== "active") return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [party?.status]);

  async function perform(operation: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await operation();
    } catch (failure) {
      setError(failure instanceof FriendsError ? failure.message : "Could not reach the Friends server. Check that Flask is running.");
    } finally {
      setBusy(false);
    }
  }

  function changeParty(path: string, method: string, body?: object) {
    return perform(async () => showParty((await callApi<PartyResponse>(path, token, method, body)).party));
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setNotice("Code copied.");
    } catch {
      setNotice("Select and copy the code from the page.");
    }
  }

  const self = party?.members.find((member) => member.id === profile?.id);
  const host = party?.host_id === profile?.id;
  const readyCount = party?.members.filter((member) => member.ready).length ?? 0;
  const remaining = deadline === null ? 0 : deadline - now;
  const focusing = party?.status === "active" && remaining > 0;

  return (
    <section className="content-card friends-panel" aria-labelledby="friends-title">
      <h2 id="friends-title">Focus together</h2>
      <p className="muted">Add friends by code and start a shared focus session.</p>
      {error && <p className="task-form-error" role="alert">{error}</p>}
      <p className="friends-notice" role="status">{connectionError || notice}</p>

      {!token ? (
        <form className="friends-form" onSubmit={(event) => {
          const display_name = formValue(event, "display_name");
          void perform(async () => {
            const result = await callApi<{ token: string; profile: Profile }>("/users", undefined, "POST", { display_name });
            localStorage.setItem(tokenKey, result.token);
            localStorage.setItem(sharingKey, "false");
            setToken(result.token);
            setProfile(result.profile);
          });
        }}>
          <label>Display name<input name="display_name" required maxLength={24} autoComplete="nickname" /></label>
          <button className="primary-button" disabled={busy}>Create friend profile</button>
        </form>
      ) : !profile ? <p>Connecting your profile…</p> : (
        <>
          <section className="friends-section" aria-labelledby="party-title">
            <div className="friends-heading"><h3 id="party-title">{party ? "Your party" : "Party lobby"}</h3>
              {party && <span className="count-chip">{party.members.length} joined</span>}
            </div>
            {party ? (
              <>
                <p className="friends-code">Party code <code>{party.code}</code> <button className="text-button" onClick={() => void copyCode(party.code)}>Copy party code</button></p>
                {party.status === "lobby" ? <p className="muted">{readyCount} of {party.members.length} ready. At least two players are needed.</p>
                  : <p className="party-timer">{focusing ? <>Focus time left <strong>{formatCountdown(remaining)}</strong></> : "Focus session complete"}</p>}
                <ul className="friends-list" aria-label="Party members">
                  {party.members.map((member) => <li key={member.id}>
                    <span><span aria-hidden="true">{member.pet_avatar} </span>{member.display_name}{member.id === profile.id ? " (you)" : ""}{member.id === party.host_id ? " · Host" : ""}</span>
                    <span>{party.status === "lobby" ? member.ready ? "Ready" : "Waiting" : focusing ? "In session" : "Finished"}</span>
                  </li>)}
                </ul>
                <div className="friends-actions">
                  {party.status === "lobby" && <button className="primary-button" disabled={busy} onClick={() => void changeParty("/parties/current", "PATCH", { action: "ready", ready: !self?.ready })}>{self?.ready ? "Mark not ready" : "Ready up"}</button>}
                  {host && (party.status === "lobby"
                    ? <button className="friends-secondary" disabled={busy || party.members.length < 2 || readyCount !== party.members.length} onClick={() => void changeParty("/parties/current", "PATCH", { action: "start" })}>Start 25-minute focus</button>
                    : <button className="friends-secondary" disabled={busy} onClick={() => void changeParty("/parties/current", "PATCH", { action: "reset" })}>{focusing ? "End session" : "Reopen lobby"}</button>)}
                  <button className="text-button" disabled={busy} onClick={() => void changeParty("/parties/current", "DELETE")}>Leave party</button>
                </div>
              </>
            ) : (
              <div className="friends-join">
                <button className="primary-button" disabled={busy} onClick={() => void changeParty("/parties", "POST")}>Create party</button>
                <form className="friends-form" onSubmit={(event) => void changeParty("/parties/join", "POST", { code: formValue(event, "code") })}>
                  <label>Party code<input name="code" required minLength={10} maxLength={10} autoComplete="off" /></label>
                  <button className="friends-secondary" disabled={busy}>Join party</button>
                </form>
              </div>
            )}
          </section>

          <section className="friends-section" aria-labelledby="connections-title">
            <h3 id="connections-title">Friends</h3>
            <label className="screen-share"><input type="checkbox" checked={Boolean(profile.share_screen_time)} disabled={busy} onChange={(event) => {
              const enabled = event.target.checked;
              void perform(async () => {
                const result = await callApi<{ enabled: boolean }>("/me/screen-time", token, "PATCH", { enabled, ...screenTime });
                localStorage.setItem(sharingKey, String(result.enabled));
                setProfile((current) => current && { ...current, share_screen_time: result.enabled });
              });
            }} /> Share my daily screen-time total with friends</label>
            <p className="friends-code">Your friend code <code>{profile.friend_code}</code> <button className="text-button" onClick={() => void copyCode(profile.friend_code)}>Copy friend code</button></p>
            <form className="friends-form" onSubmit={(event) => {
              const friend_code = formValue(event, "friend_code");
              void perform(async () => {
                const { friend } = await callApi<{ friend: Profile }>("/friends", token, "POST", { friend_code });
                setFriends((previous) => previous.some((item) => item.id === friend.id) ? previous : [...previous, friend]);
                setNotice(`${friend.display_name} is in your friends list.`);
              });
            }}>
              <label>Friend code<input name="friend_code" required minLength={8} maxLength={8} autoComplete="off" /></label>
              <button className="friends-secondary" disabled={busy}>Add friend</button>
            </form>
            {friends.length > 0 ? <ul className="friends-list" aria-label="Friends list">{friends.map((friend) => <li key={friend.id}><span>{friend.display_name}</span><span><span aria-hidden="true">{friend.pet_avatar} </span>{friend.pet_name}{friend.screen_time && <small className="shared-time">{formatScreenTime(friend.screen_time.seconds)} screen time · {friend.screen_time.day}</small>}</span></li>)}</ul>
              : <p className="muted friends-empty">Friends you add will appear here.</p>}
          </section>
        </>
      )}
    </section>
  );
}
