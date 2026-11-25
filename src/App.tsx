import { useCallback, useEffect, useMemo, useState } from "react";
import AccountPanel from "./features/accounts/AccountPanel";
import ActivityPanel from "./features/activity/ActivityPanel";
import { activityDay, recordAppCapture, setAppPreference, type ActivityCapture } from "./features/activity/activity";
import { useActivityCapture } from "./features/activity/useActivityCapture";
import FriendsPanel from "./features/friends/FriendsPanel";
import { useScreenTimeSharing } from "./features/friends/screenTimeSharing";
import PetRoom from "./features/pet/PetRoom";
import { applyPetAction, toggleTaskProgress, XP_PER_LEVEL, type PlannerProgress } from "./features/pet/progression";
import TaskBoard from "./features/tasks/TaskBoard";
import TaskReminder from "./features/tasks/TaskReminder";
import CalendarPanel from "./features/tasks/CalendarPanel";
import { getDashboardSummary } from "./features/tasks/dashboard";
import { dashboardStats as dashboardStatsForRedesign } from "./features/tasks/dashboardStats";
import { formatScreenTime } from "./features/tasks/dashboardStats";
import { getReminders } from "./features/tasks/reminders";
import { getSmartReminder } from "./features/tasks/smart-reminders";
import { getCurrentStreak } from "./features/tasks/streaks";
import type { Page, Pet, PetAction, Task } from "./types";

const starterTasks: Task[] = [
  { id: "task-1", title: "Review the PC Pet demo plan", done: true, completedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), xpAwarded: true },
  { id: "task-2", title: "Polish the pet's room", done: false, dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() },
  { id: "task-3", title: "Prepare the final pitch", done: false, dueAt: demoDate(1, 11) },
];
const starterPet: Pet = { name: "Pixel", hunger: 35, happiness: 70, energy: 80, xp: 20, level: 1, avatar: "🐶", roomTheme: "lavender" };
const primaryNav: { id: Page; label: string }[] = [
  { id: "home", label: "Home" }, { id: "tasks", label: "Tasks" },
  { id: "reminders", label: "Reminders" }, { id: "streaks", label: "Streaks & XP" },
];
const railNav: { id: Page; label: string; icon: string }[] = [
  { id: "pet", label: "Pet room", icon: "✿" }, { id: "friends", label: "Friends", icon: "♡" },
  { id: "calendar", label: "Calendar", icon: "▦" }, { id: "activity", label: "Activity", icon: "◷" },
  { id: "account", label: "Settings", icon: "⚙" },
];
const titles: Record<Page, string> = { home: "YOUR LITTLE WINS", tasks: "TASKS", reminders: "REMINDERS", streaks: "STREAKS & XP", pet: "PET ROOM", friends: "FRIENDS", calendar: "CALENDAR", activity: "ACTIVITY", account: "SETTINGS & PRIVACY" };

function load<T,>(key: string, fallback: T): T {
  try { const saved = localStorage.getItem(key); return saved ? JSON.parse(saved) as T : fallback; } catch { return fallback; }
}
function loadProgress(): PlannerProgress {
  const saved = load<Omit<PlannerProgress, "reward"> | null>("gencity-progress", null);
  const tasks = saved?.tasks ?? load("gencity-tasks", starterTasks);
  const pet = saved?.pet ?? load("gencity-pet", starterPet);
  return { tasks, pet: pet.avatar === "??" ? { ...pet, avatar: "🐶" } : pet, activity: saved?.activity };
}
function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function shiftDate(date: Date, offset: number) { const next = new Date(date); next.setDate(next.getDate() + offset); return next; }
function formatDate(date: Date) { return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }); }
function demoDate(dayOffset: number, hour = 10) { const date = new Date(); date.setDate(date.getDate() + dayOffset); date.setHours(hour, 0, 0, 0); return date.toISOString(); }
function bestTaskStreak(tasks: readonly Task[]) {
  const days = [...new Set(tasks.filter((task) => task.done && task.completedAt).map((task) => dateKey(new Date(task.completedAt!))))].sort();
  let best = 0, current = 0, previous: Date | undefined;
  for (const key of days) {
    const day = new Date(`${key}T12:00:00`);
    current = previous && (day.getTime() - previous.getTime()) < 26 * 60 * 60 * 1000 ? current + 1 : 1;
    best = Math.max(best, current); previous = day;
  }
  return best;
}

function MeterPill({ label, value }: { label: string; value: number }) {
  return <div className="pet-meter-pill"><span>{label}</span><strong>{Math.max(0, Math.min(100, value))}%</strong><i><b style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></i></div>;
}

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [progress, setProgress] = useState(loadProgress);
  const [search, setSearch] = useState("");
  const [taskFilter, setTaskFilter] = useState<"all" | "open" | "done">("all");
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const { tasks, pet, reward, activity } = progress;
  const now = new Date();
  const today = dateKey(now);
  const reminders = useMemo(() => getReminders(tasks), [tasks]);
  const dueSoon = tasks.filter((task) => !task.done && task.dueAt && Date.parse(task.dueAt) <= now.getTime()).length;
  const completedToday = tasks.filter((task) => task.done && task.completedAt && dateKey(new Date(task.completedAt)) === today).length;
  const completed = tasks.filter((task) => task.done).length;
  const completionRate = tasks.length ? Math.round(completed / tasks.length * 100) : 0;
  const bestStreak = bestTaskStreak(tasks);
  const weekStart = shiftDate(now, -6); weekStart.setHours(0, 0, 0, 0);
  const completedThisWeek = tasks.filter((task) => task.done && task.completedAt && new Date(task.completedAt) >= weekStart).length;
  const active = tasks.filter((task) => !task.done).length;
  const streak = getCurrentStreak(tasks, now);
  const summary = getDashboardSummary(tasks, now);
  const levelProgress = pet.xp % XP_PER_LEVEL;
  const onCapture = useCallback((capture: ActivityCapture) => setProgress((current) => recordAppCapture(current, capture, new Date())), []);
  const tracking = useActivityCapture(onCapture);

  useEffect(() => { localStorage.setItem("gencity-progress", JSON.stringify({ tasks, pet, activity })); }, [tasks, pet, activity]);
  useEffect(() => { document.title = `${titles[page]} · PC Pet`; }, [page]);
  useEffect(() => {
    if (!reward) return;
    const timeout = window.setTimeout(() => setProgress((current) => ({ ...current, reward: undefined })), 2600);
    return () => window.clearTimeout(timeout);
  }, [reward]);
  const stats = useMemo(() => importDashboardStats(tasks, activity, now), [tasks, activity]);
  useScreenTimeSharing({ day: activityDay(now), seconds: stats.activeSecondsToday });

  function completeTask(id: string) { setProgress((current) => toggleTaskProgress(current, id)); }
  function addTask(task: Pick<Task, "title" | "description" | "dueAt">) {
    setProgress((current) => ({ ...current, tasks: [...current.tasks, { ...task, id: crypto.randomUUID(), done: false }] }));
    setNotice("Task added to your plan.");
    window.setTimeout(() => setNotice(""), 2400);
  }
  function dismissTaskReminder(id: string) { setProgress((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, reminderDismissed: true } : task) })); }
  function act(action: PetAction) { setProgress((current) => applyPetAction(current, action)); }
  function renamePet(name: string) { setProgress((current) => ({ ...current, pet: { ...current.pet, name } })); }
  function customisePet(change: Partial<Pick<Pet, "avatar" | "roomTheme">>) { setProgress((current) => ({ ...current, pet: { ...current.pet, ...change } })); }
  function changeAppPreference(name: string, change: { rewards?: boolean; hidden?: boolean }) { setProgress((current) => setAppPreference(current, name, change, new Date())); }
  function downloadData() {
    const data = { exportedAt: new Date().toISOString(), progress: JSON.parse(localStorage.getItem("gencity-progress") ?? "{}"), legacyTasks: load("gencity-tasks", []), legacyPet: load("gencity-pet", null) };
    const href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
    const link = document.createElement("a"); link.href = href; link.download = "pc-pet-data.json"; link.click(); URL.revokeObjectURL(href);
    setNotice("Your data export is ready."); window.setTimeout(() => setNotice(""), 2400);
  }
  function loadDemoData() {
    setProgress((current) => {
      if (current.tasks.some((task) => task.id.startsWith("demo-"))) return current;
      const sample: Task[] = [
        { id: "demo-notes", title: "Review lecture notes", done: true, completedAt: demoDate(0, 9), xpAwarded: true },
        { id: "demo-reading", title: "Read the project brief", done: true, completedAt: demoDate(-1, 16), xpAwarded: true },
        { id: "demo-wireframe", title: "Sketch the pet room", done: true, completedAt: demoDate(-2, 14), xpAwarded: true },
        { id: "demo-checkin", title: "Check in with the team", done: true, completedAt: demoDate(-4, 12), xpAwarded: true },
        { id: "demo-overdue", title: "Choose a name for the demo", done: false, dueAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), description: "Pick a name everyone likes." },
        { id: "demo-prototype", title: "Polish the home dashboard", done: false, dueAt: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
        { id: "demo-mobile", title: "Check the mobile layout", done: false, dueAt: demoDate(1, 11) },
        { id: "demo-pitch", title: "Prepare the project pitch", done: false, dueAt: demoDate(2, 15) },
      ];
      const xp = current.pet.xp === 0 ? 65 : current.pet.xp;
      const pet = current.pet.xp === 0 ? { ...current.pet, xp, level: Math.floor(xp / XP_PER_LEVEL) + 1 } : current.pet;
      return { ...current, tasks: [...current.tasks, ...sample], pet };
    });
    setNotice("Demo tasks added. Your saved tasks and pet data were kept.");
    window.setTimeout(() => setNotice(""), 3500);
  }

  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = `${task.title} ${task.description ?? ""}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter = taskFilter === "all" || (taskFilter === "done" ? task.done : !task.done);
    return matchesSearch && matchesFilter;
  });
  const streakDays = Array.from({ length: 30 }, (_, i) => {
    const date = shiftDate(now, i - 29);
    const key = dateKey(date);
    const count = tasks.filter((task) => task.done && task.completedAt && dateKey(new Date(task.completedAt)) === key).length;
    return { key, label: date.toLocaleDateString(undefined, { month: "short", day: "numeric" }), count };
  });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = shiftDate(now, i - 6);
    const key = dateKey(date);
    const done = tasks.filter((task) => task.done && task.completedAt && dateKey(new Date(task.completedAt)) === key).length;
    const missed = tasks.filter((task) => !task.done && task.dueAt && dateKey(new Date(task.dueAt)) === key && Date.parse(task.dueAt) < now.getTime()).length;
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), done, missed };
  });

  return <div className="redesign-shell">
    <header className="topbar">
      <button className="brand-lockup" onClick={() => setPage("home")} aria-label="PC Pet home"><span className="brand-mark">🐾</span><span>pc pet<small>your day, together</small></span></button>
      <nav className="top-nav" aria-label="Primary navigation">{primaryNav.map((item) => <button key={item.id} className={page === item.id ? "top-nav-link selected" : "top-nav-link"} onClick={() => setPage(item.id)}>{item.label}</button>)}</nav>
      <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Search tasks" placeholder="Search your plan" value={search} onChange={(e) => { setSearch(e.target.value); if (e.target.value) setPage("tasks"); }} /></label>
      <button className="profile-pill" onClick={() => setPage("account")} aria-label={`Settings, ${reminders.length} reminders`}><span className="profile-avatar">{pet.avatar ?? "🐶"}</span><span className="profile-name">{pet.name}<small>Level {pet.level}</small></span><b className="notification-dot">{reminders.length}</b></button>
    </header>
    <aside className="side-rail" aria-label="More pages">
      {railNav.map((item) => <button key={item.id} className={page === item.id ? "rail-button active" : "rail-button"} aria-label={item.label} title={item.label} onClick={() => setPage(item.id)}>{item.icon}</button>)}
      <span className="rail-spacer" />
      <button className="rail-add" aria-label="Add a task" title="Add a task" onClick={() => setPage("tasks")}>＋</button>
    </aside>
    <main className="page-content">
      <div className="page-heading"><div><span className="eyebrow">{page === "home" ? `HELLO, ${pet.name.toUpperCase()}` : "YOUR PC PET SPACE"}</span><h1>{titles[page]}</h1></div><div className="heading-actions">
        {page === "tasks" ? <div className="pill-group" aria-label="Filter tasks">{(["all", "open", "done"] as const).map((f) => <button key={f} className={taskFilter === f ? "filter-pill active" : "filter-pill"} onClick={() => setTaskFilter(f)}>{f === "all" ? "All tasks" : f === "open" ? "To do" : "Done"}</button>)}</div> : page === "home" || page === "streaks" ? <>{page === "home" && !tasks.some((task) => task.id.startsWith("demo-")) && <button className="filter-pill" onClick={loadDemoData}>Load demo data</button>}<span className="filter-pill active">{page === "home" ? "This week 　⌄" : "Last 30 days"}</span></> : <button className="filter-pill active" onClick={() => setPage("tasks")}>Your plan →</button>}
        <button className="primary-button add-task-top" onClick={() => setPage("tasks")}>＋ Add task</button>
      </div></div>
      {notice && <p className="toast-note" role="status">{notice}</p>}
      {reward && <div className="reward-toast" role="status"><strong>+{reward.amount} XP</strong><span>{reward.levelReached ? `You reached level ${reward.levelReached}!` : "A little progress adds up."}</span></div>}

      {page === "home" && <div className="dashboard-layout">
        <section className="stat-grid">
          <article className="stat-card card-surface"><div className="card-topline"><span>COMPLETION RATE</span><span className="trend-up">▲</span></div><strong className="stat-number">{completionRate}<small>%</small></strong><span className="stat-caption">{completed} of {tasks.length} tasks complete</span><div className="mini-progress"><i style={{ width: `${completionRate}%` }} /></div></article>
          <article className="stat-card card-surface coral-card"><div className="card-topline"><span>OVERDUE</span><span className="trend-down">▼</span></div><strong className="stat-number">{dueSoon}<small> tasks</small></strong><span className="stat-caption">Needs a little attention</span><button className="inline-link" onClick={() => setPage("reminders")}>View reminders →</button></article>
          <article className="stat-card card-surface"><div className="card-topline"><span>DONE TODAY</span><span>✓</span></div><strong className="stat-number">{completedToday}</strong><span className="stat-caption">{completedThisWeek} completed this week</span><div className="mini-progress"><i style={{ width: `${Math.min(completedThisWeek * 14, 100)}%` }} /></div></article>
          <article className="stat-card card-surface"><div className="card-topline"><span>CURRENT STREAK</span><span>✦</span></div><strong className="stat-number">{streak}<small> days</small></strong><span className="stat-caption">Best streak: {bestStreak} days</span></article>
          <article className="stat-card card-surface xp-card"><div className="card-topline"><span>PET LEVEL & XP</span><span>✦</span></div><strong className="stat-number">LVL {pet.level}</strong><span className="stat-caption">{pet.xp} total XP · {XP_PER_LEVEL - levelProgress} to next</span><div className="xp-bar"><i style={{ width: `${levelProgress}%` }} /></div></article>
          <article className="stat-card card-surface"><div className="card-topline"><span>FOCUS TIME TODAY</span><span>◷</span></div><strong className="stat-number stat-time">{formatScreenTime(stats.activeSecondsToday)}</strong><span className="stat-caption">{formatScreenTime(stats.activeSecondsTotal)} total tracked</span></article>
        </section>
        <section className="card-surface streak-card"><div className="section-title"><div><span className="eyebrow">SHOWING UP COUNTS</span><h2>{streak} day streak <span className="streak-flame">✦</span></h2></div><button className="inline-link" onClick={() => setPage("streaks")}>See your progress →</button></div><div className="streak-dots" aria-label="Task completions over the last 30 days">{streakDays.map((d) => <i key={d.key} title={`${d.label}: ${d.count} completed`} className={d.count ? `dot-level-${Math.min(4, d.count)}` : ""} />)}</div><div className="dot-legend"><span>Less</span><i /><i /><i /><i /><span>More</span></div></section>
        <section className="card-surface weekly-card"><div className="section-title"><div><span className="eyebrow">ONE DAY AT A TIME</span><h2>Your week</h2></div><div className="chart-legend"><span><i className="legend-done" />Done</span><span><i className="legend-missed" />Missed</span></div></div><div className="week-chart">{weekDays.map((d) => <div className="week-column" key={d.label}><div className="capsules"><i className="capsule done" style={{ height: `${Math.max(8, Math.min(100, d.done * 24))}%` }} title={`${d.done} done`} /><i className="capsule missed" style={{ height: `${Math.max(8, Math.min(100, d.missed * 24))}%` }} title={`${d.missed} missed`} /></div><span>{d.label}</span></div>)}</div></section>
        <section className="card-surface upcoming-card"><div className="section-title"><div><span className="eyebrow">COMING UP</span><h2>Your timeline</h2></div><button className="inline-link" onClick={() => setPage("reminders")}>All reminders →</button></div>{reminders.length ? <div className="timeline-list">{reminders.slice(0, 5).map((item, index) => <div className="timeline-row" key={`${item.title}-${index}`}><span className={`timeline-dot ${item.dueAt < now ? "late" : ""}`} /><span className="timeline-time">{formatDate(item.dueAt)}</span><span className={`timeline-bar ${item.dueAt < now ? "late" : ""}`}>{item.title}</span></div>)}</div> : <div className="empty-card"><span>☀</span><p>Nothing scheduled yet. Add a task to start your timeline.</p><button className="inline-link" onClick={() => setPage("tasks")}>Make a task →</button></div>}</section>
        <section className="card-surface home-pet-card"><div className="section-title"><div><span className="eyebrow">YOUR SIDEKICK</span><h2>{pet.name}</h2></div><button className="round-action" aria-label="Open pet room" onClick={() => setPage("pet")}>↗</button></div><div className="pet-home-body"><div className="pet-home-avatar bob" role="img" aria-label={pet.name}>{pet.avatar ?? "🐶"}</div><div className="pet-meters"><MeterPill label="Fullness" value={100 - pet.hunger} /><MeterPill label="Happiness" value={pet.happiness} /><MeterPill label="Energy" value={pet.energy} /></div></div><button className="pet-card-link" onClick={() => setPage("pet")}>Visit pet room <span>→</span></button></section>
      </div>}

      {page === "tasks" && <section className="feature-page card-surface"><div className="section-title"><div><span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span><h2>Your task list</h2></div><span className="count-pill">{active} to do</span></div><TaskBoard tasks={filteredTasks} onToggle={completeTask} onAdd={addTask} /></section>}
      {page === "reminders" && <section className="feature-page card-surface"><div className="section-title"><div><span className="eyebrow">A GENTLE NUDGE</span><h2>Reminders</h2></div><span className="count-pill">{reminders.length} upcoming</span></div>{getSmartReminder(tasks, now) && <aside className="smart-callout"><b>✦</b><span>{getSmartReminder(tasks, now)}</span></aside>}{reminders.length ? <div className="reminder-list">{reminders.map((item, i) => <article className="reminder-row" key={`${item.title}-${item.dueAt.toISOString()}-${i}`}><span className={`reminder-date ${item.dueAt < now ? "late" : ""}`}>{item.dueAt.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span><div><strong>{item.title}</strong><small>{item.dueAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}{item.dueAt < now ? " · Overdue" : ""}</small></div><button className="check-button" aria-label={`Complete ${item.title}`} onClick={() => { const task = tasks.find((t) => t.title === item.title && !t.done && t.dueAt && Date.parse(t.dueAt) === item.dueAt.getTime()); if (task) completeTask(task.id); }}>✓</button></article>)}</div> : <div className="empty-card"><span>✦</span><p>You're all clear. Tasks with a due date will appear here.</p><button className="inline-link" onClick={() => setPage("tasks")}>Add a task →</button></div>}</section>}
      {page === "streaks" && <div className="progress-page"><section className="card-surface streak-card"><div className="section-title"><div><span className="eyebrow">YOUR CONSISTENCY</span><h2>{streak} day streak</h2><p className="muted">Complete one task a day to keep your rhythm.</p></div><span className="big-streak">{streak}<small>days</small></span></div><div className="streak-dots large-dots">{streakDays.map((d) => <i key={d.key} title={`${d.label}: ${d.count} completed`} className={d.count ? `dot-level-${Math.min(4, d.count)}` : ""} />)}</div></section><section className="card-surface weekly-card"><div className="section-title"><div><span className="eyebrow">YOUR XP</span><h2>Level {pet.level}</h2></div><span className="count-pill">{pet.xp} total XP</span></div><p>{XP_PER_LEVEL - levelProgress} XP until the next level</p><div className="xp-bar wide"><i style={{ width: `${levelProgress}%` }} /></div><div className="week-chart">{weekDays.map((d) => <div className="week-column" key={d.label}><div className="capsules"><i className="capsule done" style={{ height: `${Math.max(8, Math.min(100, d.done * 24))}%` }} /><i className="capsule missed" style={{ height: `${Math.max(8, Math.min(100, d.missed * 24))}%` }} /></div><span>{d.label}</span></div>)}</div><p className="muted">{summary.completed} tasks completed · {summary.remaining} left</p></section></div>}
      {page === "pet" && <PetRoom pet={pet} onAction={act} onRename={renamePet} onCustomise={customisePet} onNavigate={setPage} />}
      {page === "friends" && <FriendsPanel screenTime={{ day: activityDay(now), seconds: stats.activeSecondsToday }} />}
      {page === "calendar" && <CalendarPanel tasks={tasks} onViewTasks={() => setPage("tasks")} />}
      {page === "activity" && <ActivityPanel activity={activity} tracking={tracking} onPreference={changeAppPreference} />}
      {page === "account" && <div className="settings-layout"><section className="card-surface privacy-card"><span className="eyebrow">YOUR DATA, YOUR CALL</span><h2>Settings & privacy</h2><p>PC Pet stores planner tasks and pet progress in this browser so your saved data stays available when you return.</p><div className="privacy-points"><span>✓ Tasks and due dates</span><span>✓ Pet name, needs and XP</span><span>✓ Activity preferences</span></div><button className="primary-button" onClick={downloadData}>Download my data</button><div className="overlay-info"><strong>Desktop overlay</strong><p>The floating pet button is the browser overlay. The separate always-on-top app is in <code>desktop/PetOverlay</code> and currently targets macOS.</p></div></section><div className="card-surface account-card"><AccountPanel /></div></div>}
      <footer className="page-footer">Made with care for your little companion <span>✦</span></footer>
    </main>
    <TaskReminder tasks={tasks} pet={pet} onDismiss={dismissTaskReminder} onViewTasks={() => setPage("reminders")} />
    <div className={`browser-pet-overlay${overlayOpen ? " is-open" : ""}`}>
      {overlayOpen && <section className="overlay-card" aria-label={`${pet.name} floating companion`}><button className="overlay-close" onClick={() => setOverlayOpen(false)} aria-label="Close pet overlay">×</button><div className="overlay-pet-avatar">{pet.avatar ?? "🐶"}</div><div className="overlay-pet-copy"><span className="eyebrow">YOUR COMPANION</span><strong>{pet.name}</strong><small>{pet.hunger > 70 ? "Could use a snack" : pet.energy < 25 ? "Ready for a rest" : "Here with you"}</small></div><div className="overlay-actions"><button onClick={() => act("feed")} disabled={pet.hunger <= 0}>Feed</button><button onClick={() => act("play")} disabled={pet.energy < 15}>Play +5 XP</button><button onClick={() => { setPage("pet"); setOverlayOpen(false); }}>Pet room ↗</button></div></section>}
      <button className="overlay-launcher" onClick={() => setOverlayOpen((open) => !open)} aria-label={overlayOpen ? "Hide browser pet overlay" : `Show floating pet overlay for ${pet.name}`} title="Floating pet overlay"><span>{pet.avatar ?? "🐶"}</span>{dueSoon > 0 && <b>{dueSoon}</b>}</button>
    </div>
  </div>;
}

function importDashboardStats(tasks: Task[], activity: PlannerProgress["activity"], now: Date) {
  // Kept in one place so the redesigned dashboard still uses the existing activity totals.
  return dashboardStatsForRedesign(tasks, activity, now);
}
