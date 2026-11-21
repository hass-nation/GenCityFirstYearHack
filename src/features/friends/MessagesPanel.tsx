import { useEffect, useState, type FormEvent } from "react";
import { localProfileKey } from "../accounts/AccountPanel";
import { identityKey, messagingRequest, type FriendMessage } from "./messages";

type Profile = { display_name: string; friend_code: string };

export default function MessagesPanel({ inbox }: { inbox: FriendMessage[] }) {
  const [token, setToken] = useState(() => localStorage.getItem(identityKey) ?? "");
  const [profile, setProfile] = useState<Profile>();
  const [friends, setFriends] = useState<Profile[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void Promise.all([
      messagingRequest<{ profile: Profile }>("/api/me", token, undefined, controller.signal),
      messagingRequest<{ friends: Profile[] }>("/api/friends", token, undefined, controller.signal),
    ]).then(([me, list]) => {
      setProfile(me.profile);
      setFriends(list.friends);
    }).catch((failure: Error) => {
      if (!controller.signal.aborted) setError(failure.message);
    });
    return () => controller.abort();
  }, [token]);

  async function perform(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try { await operation(); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "Could not complete the request."); }
    finally { setBusy(false); }
  }

  function addFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const friend_code = new FormData(form).get("code");
    void perform(async () => {
      const { friend } = await messagingRequest<{ friend: Profile }>("/api/friends", token, { friend_code });
      setFriends((known) => [...known.filter((entry) => entry.friend_code !== friend.friend_code), friend]);
      form.reset();
    });
  }

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    void perform(async () => {
      const { id } = await messagingRequest<{ id: string }>("/api/desktop-pet/delivery", token, {
        friend_code: data.get("friend"), body: data.get("message"),
      });
      setNotice("Waiting for your desktop pet to deliver the message…");
      const until = Date.now() + 65_000;
      while (Date.now() < until) {
        const { status } = await messagingRequest<{ status: string }>(`/api/desktop-pet/delivery/${id}`, token);
        if (status === "sent") {
          form.reset();
          setNotice("Message delivered.");
          return;
        }
        if (status === "expired") break;
        await new Promise((resolve) => window.setTimeout(resolve, 800));
      }
      setNotice("");
      throw new Error("The pet didn’t finish the delivery. Check that your Windows companion is running.");
    });
  }

  return <section className="content-card">
    <h2>Friend messages</h2>
    <p className="muted">Use the same demo server as your friend. On Windows, your desktop pet walks offscreen to deliver your message.</p>
    {!token && <button className="primary-button" disabled={busy} onClick={() => void perform(async () => {
      const identity = await messagingRequest<{ token: string }>("/api/users", undefined, { display_name: localStorage.getItem(localProfileKey) || "Guest" });
      localStorage.setItem(identityKey, identity.token);
      setToken(identity.token);
    })}>Get my friend code</button>}
    {profile && <>
      <p className="friends-code">Your friend code <code>{profile.friend_code}</code></p>
      <form className="friends-form" onSubmit={addFriend}>
        <label>Friend code<input name="code" required minLength={8} maxLength={8} /></label>
        <button className="friends-secondary" disabled={busy}>Add friend</button>
      </form>
      {friends.length > 0 && <form className="add-task-form friends-section" onSubmit={send}>
        <label>To <select name="friend" required>{friends.map((friend) => <option key={friend.friend_code} value={friend.friend_code}>{friend.display_name}</option>)}</select></label>
        <label>Message<textarea name="message" maxLength={500} required /></label>
        <button className="primary-button" disabled={busy}>Send with pet</button>
      </form>}
    </>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert" className="task-form-error">{error}</p>}
    <section className="friends-section" aria-label="Inbox">
      <h3>Inbox</h3>
      {inbox.length ? <ul className="friends-list">{inbox.map((message) => <li key={message.id}><strong>{message.sender_name}</strong><span>{message.body}</span></li>)}</ul>
        : <p className="muted">No messages yet.</p>}
    </section>
  </section>;
}
