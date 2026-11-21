import { useEffect, useState, type FormEvent } from "react";
import {
  createCompanionProfile,
  fetchCompanionProfile,
  fetchFriends,
  forgetCompanionToken,
  joinFriendByCode,
  savedCompanionToken,
  type CompanionProfile,
} from "./friendsApi";

export default function FriendsPage() {
  const [token, setToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<CompanionProfile | null>(null);
  const [friends, setFriends] = useState<CompanionProfile[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [friendCode, setFriendCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const savedToken = savedCompanionToken();
    if (!savedToken) return;
    setToken(savedToken);
    void Promise.all([fetchCompanionProfile(savedToken), fetchFriends(savedToken)])
      .then(([savedProfile, savedFriends]) => {
        setProfile(savedProfile);
        setFriends(savedFriends);
      })
      .catch((cause: unknown) => {
        forgetCompanionToken();
        setToken(null);
        setError(cause instanceof Error ? cause.message : "Could not load your friend profile.");
      });
  }, []);

  async function handleCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await createCompanionProfile(displayName.trim());
      setToken(result.token);
      setProfile(result.profile);
      setFriends([]);
      setNotice("Your profile is ready. Share the code below so a friend can add you.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoinFriend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await joinFriendByCode(token, friendCode.trim().toUpperCase());
      setFriends(await fetchFriends(token));
      setFriendCode("");
      setNotice("Friend added. You are now connected.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join that friend.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode() {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(profile.friend_code);
      setNotice("Friend code copied.");
    } catch {
      setNotice("Copy is unavailable here. Select and copy the code above.");
    }
  }

  if (!profile) {
    return (
      <section className="friends-page">
        <div className="content-card friends-intro">
          <p className="eyebrow">YOUR PEOPLE</p>
          <h2>Make a companion profile</h2>
          <p className="muted">Create a profile to get a code you can share with friends. This profile is used for friend connections and is separate from your browser pet save.</p>
          <form className="friend-form" onSubmit={handleCreateProfile}>
            <label htmlFor="friend-display-name">Your display name</label>
            <div className="friend-form-row">
              <input id="friend-display-name" value={displayName} maxLength={24} required onChange={(event) => setDisplayName(event.target.value)} placeholder="e.g. Hassan" />
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "Creating…" : "Create profile"}</button>
            </div>
          </form>
          {error && <p className="friend-message error" role="alert">{error}</p>}
          {notice && <p className="friend-message" role="status">{notice}</p>}
        </div>
      </section>
    );
  }

  return (
    <section className="friends-page">
      <div className="section-heading">
        <div><p className="eyebrow">YOUR PEOPLE</p><h2>Friends</h2><p className="muted">Share your code or enter a friend's code to connect.</p></div>
        <span className="count-chip">{friends.length} {friends.length === 1 ? "FRIEND" : "FRIENDS"}</span>
      </div>

      <div className="friends-grid">
        <section className="content-card friend-code-card" aria-labelledby="your-code-title">
          <p className="eyebrow">INVITE CODE</p>
          <h3 id="your-code-title">Your friend code</h3>
          <p className="muted">Share this code with someone you want to add.</p>
          <div className="friend-code-row">
            <output className="friend-code">{profile.friend_code}</output>
            <button className="secondary-button" type="button" onClick={() => void copyCode()}>Copy code</button>
          </div>
          <p className="friend-profile-name">Profile: <strong>{profile.display_name}</strong></p>
        </section>

        <section className="content-card" aria-labelledby="join-friend-title">
          <p className="eyebrow">JOIN A FRIEND</p>
          <h3 id="join-friend-title">Have a code?</h3>
          <form className="friend-form" onSubmit={handleJoinFriend}>
            <label htmlFor="friend-code-input">Friend code</label>
            <div className="friend-form-row">
              <input id="friend-code-input" value={friendCode} maxLength={16} required autoCapitalize="characters" onChange={(event) => setFriendCode(event.target.value.toUpperCase())} placeholder="8-character code" />
              <button className="primary-button" type="submit" disabled={busy}>{busy ? "Joining…" : "Add friend"}</button>
            </div>
          </form>
        </section>
      </div>

      {error && <p className="friend-message error" role="alert">{error}</p>}
      {notice && <p className="friend-message" role="status">{notice}</p>}

      <section className="content-card friend-list-card" aria-labelledby="friend-list-title">
        <div className="section-heading">
          <div><p className="eyebrow">CONNECTED COMPANIONS</p><h3 id="friend-list-title">Your friends</h3></div>
        </div>
        {friends.length ? (
          <ul className="friend-list">
            {friends.map((friend) => (
              <li key={friend.id}>
                <span className="friend-avatar" aria-hidden="true">{friend.pet_avatar}</span>
                <span><strong>{friend.display_name}</strong><small>{friend.pet_name}'s companion</small></span>
              </li>
            ))}
          </ul>
        ) : <p className="muted">No friends yet. Share your code or enter someone else's to get started.</p>}
      </section>
      <p className="friends-footnote">Your companion profile token stays in this browser. Friend connections are stored by the Flask server.</p>
    </section>
  );
}
