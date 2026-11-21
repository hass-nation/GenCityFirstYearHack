import { useEffect, useState, type FormEvent } from "react";
import PetSprite from "../pet/PetSprite";
import { speciesFor } from "../pet/appearance";
import { localProfileKey } from "../accounts/AccountPanel";

const tokenKey = "gencity-friends-token";
type Profile = { id: string; display_name: string; pet_avatar: string };
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
  if (token) headers.set("X-PC-Pet-Token", token);
  if (body) headers.set("Content-Type", "application/json");
  const timeout = AbortSignal.timeout(8000);
  const response = await fetch(`/api${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined, cache: "no-store",
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new FriendsError(data?.error ?? "Could not reach the party server. Check that Flask is running.", response.status);
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

export default function FriendsPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(tokenKey) ?? "");
  const [profile, setProfile] = useState<Profile | null>(null);
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
        const [me, current] = await Promise.all([
          callApi<{ profile: Profile }>("/me", token, "GET", undefined, controller.signal),
          callApi<PartyResponse>("/parties/current", token, "GET", undefined, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setProfile(me.profile);
        showParty(current.party);
        setConnectionError("");
      } catch (failure) {
        if (controller.signal.aborted) return;
        if (failure instanceof FriendsError && failure.status === 401) {
          localStorage.removeItem(tokenKey);
          setToken("");
          setProfile(null);
          showParty(null);
          setError("This server no longer recognises your profile. Create a profile to reconnect.");
          return;
        }
        setConnectionError("Could not refresh the party. Reconnecting…");
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
      setError(failure instanceof FriendsError ? failure.message : "Could not reach the party server. Check that Flask is running.");
    } finally {
      setBusy(false);
    }
  }

  function changeParty(path: string, method: string, body?: object) {
    return perform(async () => {
      let partyToken = token;
      if (!partyToken) {
        const display_name = localStorage.getItem(localProfileKey) || "Guest";
        const identity = await callApi<{ token: string; profile: Profile }>("/users", undefined, "POST", { display_name });
        partyToken = identity.token;
        localStorage.setItem(tokenKey, partyToken);
        setToken(partyToken);
        setProfile(identity.profile);
      }
      showParty((await callApi<PartyResponse>(path, partyToken, method, body)).party);
    });
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
      <p className="muted">Create a party and share its code, or enter a code to join. Everyone needs the same local demo server.</p>
      {error && <p className="task-form-error" role="alert">{error}</p>}
      <p className="friends-notice" role="status">{connectionError || notice}</p>

      {token && !profile ? <p>Connecting your party…</p> : (
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
                    <span><PetSprite className="friend-sprite" species={speciesFor(member.pet_avatar)} still />{member.display_name}{member.id === profile?.id ? " (you)" : ""}{member.id === party.host_id ? " · Host" : ""}</span>
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


        </>
      )}
    </section>
  );
}
