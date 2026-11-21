import { useState, type FormEvent } from "react";

export const localProfileKey = "gencity-local-profile";

export default function AccountPanel() {
  const [name, setName] = useState(() => localStorage.getItem(localProfileKey) ?? "");
  const [saved, setSaved] = useState(false);

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = name.trim();
    if (!clean) return;
    localStorage.setItem(localProfileKey, clean);
    setName(clean);
    setSaved(true);
  }

  return <section className="content-card">
    <h2>Local profile</h2>
    <p className="muted">Your display name, planner and pet are saved in this browser.</p>
    <form className="add-task-form" onSubmit={save}>
      <label>Display name<input value={name} required maxLength={24} onChange={(event) => {
        setName(event.target.value);
        setSaved(false);
      }} /></label>
      <button type="submit" className="primary-button" disabled={!name.trim()}>Save profile</button>
    </form>
    <p role="status">{saved ? "Profile saved on this device." : ""}</p>
  </section>;
}
