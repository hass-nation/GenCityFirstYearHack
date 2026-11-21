import { useEffect, useState, type FormEvent } from "react";
import type { Pet, PlannerSettings, Task } from "../../types";
import PetRoom from "../pet/PetRoom";
import { ACCOUNT_TOKEN_KEY, AccountApiError, createAccount, deleteAccount, getAccountExport, getAccountProfile, signIn, signOut, updateAccountPet, type AccountProfile } from "./accountApi";

type Props = {
  tasks: readonly Task[];
  pet: Pet;
  settings: PlannerSettings;
  onSettingsChange: (settings: PlannerSettings) => void;
  onRenamePet: (name: string) => void;
  onCustomisePet: (change: Partial<Pick<Pet, "avatar" | "roomTheme">>) => void;
  onDownloadData: (accountData?: Record<string, unknown>) => void;
  onDeleteData: () => void;
};

export default function SettingsPage({ tasks, pet, settings, onSettingsChange, onRenamePet, onCustomisePet, onDownloadData, onDeleteData }: Props) {
  const [deleteText, setDeleteText] = useState("");
  const [reminderNotice, setReminderNotice] = useState("");
  const [accountNotice, setAccountNotice] = useState("");
  const [accountError, setAccountError] = useState("");
  const [dataNotice, setDataNotice] = useState("");
  const [dataError, setDataError] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (!token) return;
    void getAccountProfile(token).then(({ profile: savedProfile }) => setProfile(savedProfile)).catch((cause: unknown) => {
      if (cause instanceof AccountApiError && cause.status === 401) localStorage.removeItem(ACCOUNT_TOKEN_KEY);
      setAccountError(cause instanceof Error ? cause.message : "Could not load your account.");
    });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (!token || !profile) return;
    const timer = window.setTimeout(() => {
      void updateAccountPet(token, { pet_name: pet.name, pet_avatar: pet.avatar ?? "🐶", pet_theme: pet.roomTheme ?? "lavender" })
        .catch(() => setAccountNotice("Saved on this device, but the server pet update did not complete."));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [pet.name, pet.avatar, pet.roomTheme, profile?.id]);

  async function toggleNotifications(enabled: boolean) {
    if (!enabled) {
      onSettingsChange({ ...settings, browserNotifications: false });
      setReminderNotice("");
      return;
    }
    if (!("Notification" in window)) {
      setReminderNotice("This browser does not support notifications.");
      return;
    }
    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (permission === "granted") {
      onSettingsChange({ ...settings, browserNotifications: true });
      setReminderNotice("Browser notifications are enabled.");
    } else {
      onSettingsChange({ ...settings, browserNotifications: false });
      setReminderNotice("Allow notifications in your browser to turn this on.");
    }
  }

  function updateSetting<K extends keyof PlannerSettings>(key: K, value: PlannerSettings[K]) {
    onSettingsChange({ ...settings, [key]: value });
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setAccountError("");
    setAccountNotice("");
    try {
      const result = isSignup ? await createAccount(displayName.trim(), email.trim(), password) : await signIn(email.trim(), password);
      localStorage.setItem(ACCOUNT_TOKEN_KEY, result.token);
      setProfile(result.profile);
      setPassword("");
      setAccountNotice(isSignup ? "Your account is ready. Your planner still works offline." : "You're signed in.");
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : "Could not sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadSavedData() {
    setDataError("");
    let accountData: Record<string, unknown> | undefined;
    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (token) {
      try {
        accountData = await getAccountExport(token);
      } catch (cause) {
        setDataError(cause instanceof Error ? `Account data could not be included: ${cause.message}` : "Account data could not be included.");
        return;
      }
    }
    onDownloadData(accountData);
    setDataNotice("Your data download is ready.");
  }

  async function deleteSavedData(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deleteText !== "DELETE") return;
    setBusy(true);
    setDataError("");
    try {
      const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
      if (token) await deleteAccount(token);
      onDeleteData();
      setProfile(null);
      setDeleteText("");
      setDataNotice("Your local data and linked server profile have been deleted.");
    } catch (cause) {
      setDataError(cause instanceof Error ? cause.message : "Could not delete your account data. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function signOutHere() {
    const token = localStorage.getItem(ACCOUNT_TOKEN_KEY);
    if (!token) return;
    setBusy(true);
    setAccountError("");
    try {
      await signOut(token);
      localStorage.removeItem(ACCOUNT_TOKEN_KEY);
      setProfile(null);
      setAccountNotice("You are signed out. Your local planner data is still here.");
    } catch (cause) {
      setAccountError(cause instanceof Error ? cause.message : "Could not sign out. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-page" aria-labelledby="settings-title">
      <div className="section-heading"><div><p className="eyebrow">YOUR SPACE</p><h2 id="settings-title">Settings</h2><p className="muted">Manage reminders, your companion, and your saved data.</p></div></div>

      <section className="content-card" aria-labelledby="reminder-settings-title">
        <h3 id="reminder-settings-title">Reminders</h3>
        <p className="muted">Reminders run while PC Pet is open. Browser notifications also need browser permission.</p>
        <label className="setting-row"><span><strong>In-app reminders</strong><small>Show deadline popups and the reminder list.</small></span><input type="checkbox" checked={settings.remindersEnabled} onChange={(event) => updateSetting("remindersEnabled", event.target.checked)} /></label>
        <label className="setting-row"><span><strong>Browser notifications</strong><small>Ask the browser before showing a notification.</small></span><input type="checkbox" checked={settings.browserNotifications} onChange={(event) => { void toggleNotifications(event.target.checked); }} /></label>
        <label className="setting-row"><span><strong>Quiet hours</strong><small>Pause popup and browser reminders during this time.</small></span><input type="checkbox" checked={settings.quietHoursEnabled} onChange={(event) => updateSetting("quietHoursEnabled", event.target.checked)} /></label>
        <div className="quiet-hours-fields"><label>From<input type="time" value={settings.quietHoursStart} onChange={(event) => updateSetting("quietHoursStart", event.target.value)} /></label><label>Until<input type="time" value={settings.quietHoursEnd} onChange={(event) => updateSetting("quietHoursEnd", event.target.value)} /></label></div>
        {reminderNotice && <p role="status" className="inline-notice">{reminderNotice}</p>}
      </section>

      <section className="content-card" aria-labelledby="account-title">
        <p className="eyebrow">OPTIONAL SYNC</p><h3 id="account-title">Account</h3>
        {profile ? <div className="account-status"><p>Signed in as <strong>{profile.display_name}</strong>.</p><p className="muted">Your friend code is <code>{profile.friend_code}</code>. Planner tasks and XP remain on this device.</p><button type="button" className="text-button" onClick={() => { void signOutHere(); }} disabled={busy}>Sign out</button></div> : <>
          <p className="muted">Create an account or sign in to use friends. Your planner still works offline without an account.</p>
          <form className="account-form" onSubmit={(event) => { void submitAuth(event); }}>
            {isSignup && <label>Display name<input value={displayName} maxLength={60} required onChange={(event) => setDisplayName(event.target.value)} autoComplete="name" /></label>}
            <label>Email<input type="email" value={email} maxLength={254} required onChange={(event) => setEmail(event.target.value)} autoComplete="email" /></label>
            <label>Password<input type="password" value={password} minLength={8} required onChange={(event) => setPassword(event.target.value)} autoComplete={isSignup ? "new-password" : "current-password"} /></label>
            <button type="submit" className="primary-button" disabled={busy}>{busy ? "Please wait…" : isSignup ? "Create account" : "Sign in"}</button>
          </form>
          <button type="button" className="text-button auth-mode-toggle" onClick={() => { setIsSignup(!isSignup); setAccountError(""); }}>{isSignup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
        </>}
        {accountError && <p role="alert" className="task-form-error">{accountError}</p>}
        {accountNotice && <p role="status" className="inline-notice">{accountNotice}</p>}
      </section>

      <PetRoom pet={pet} onRename={onRenamePet} onCustomise={onCustomisePet} />

      <section className="content-card privacy-copy" aria-labelledby="privacy-title">
        <p className="eyebrow">PLAIN ENGLISH</p><h3 id="privacy-title">Privacy &amp; data</h3>
        <h4>What PC Pet saves</h4>
        <p>Your tasks, completion dates, pet progress, reminder choices, and XP history are saved in this browser. If you create an account, the server also stores your email, display name, friend code, pet profile, friend connections, and messages. The server stores a one-way password hash; the app never shows or exports it.</p>
        <h4>Why and where it is stored</h4>
        <p>Local data keeps your planner available on this device. Account data supports signing in, connecting friends, and syncing your public pet profile. Browser data stays in this browser's local storage. Account and friend data is stored in the Flask server's SQLite database. The site also requests fonts from Google Fonts.</p>
        <h4>How long it is kept</h4>
        <p>Local data stays until you clear it here or clear this browser's site data. Account data stays on the server until you delete the account or the server operator removes it. There is no automatic deletion schedule.</p>
        <h4>Your controls</h4>
        <p>You can download a JSON copy of your planner data or delete the local data and, when signed in, your server profile and linked friend data.</p>
        <div className="data-actions"><button type="button" className="secondary-button" onClick={() => { void downloadSavedData(); }}>Download my data</button></div>
        <form className="delete-data-form" onSubmit={(event) => { void deleteSavedData(event); }}>
          <label htmlFor="delete-confirmation">Delete my data</label>
          <p className="muted">Type DELETE to clear this browser's planner data. If signed in, this also removes your server profile and linked friend connections.</p>
          <div className="delete-confirm-row"><input id="delete-confirmation" value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" /><button type="submit" className="danger-button" disabled={deleteText !== "DELETE" || busy}>Delete data</button></div>
        </form>
        {dataError && <p role="alert" className="task-form-error">{dataError}</p>}
        {dataNotice && <p role="status" className="inline-notice">{dataNotice}</p>}
      </section>
      <span className="sr-only">{tasks.length} planner tasks saved.</span>
    </section>
  );
}
