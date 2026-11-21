import { useCallback, useEffect, useState } from "react";
import AccountPanel from "./features/accounts/AccountPanel";
import ActivityPanel from "./features/activity/ActivityPanel";
import { activityDay, recordAppCapture, setAppPreference, type ActivityCapture } from "./features/activity/activity";
import { useActivityCapture } from "./features/activity/useActivityCapture";
import FriendsPanel from "./features/friends/FriendsPanel";
import { useScreenTimeSharing } from "./features/friends/screenTimeSharing";
import PetRoom from "./features/pet/PetRoom";
import { applyPetAction, toggleTaskProgress, type PlannerProgress } from "./features/pet/progression";
import TaskBoard from "./features/tasks/TaskBoard";
import TaskReminder from "./features/tasks/TaskReminder";
import CalendarPanel from "./features/tasks/CalendarPanel";
import RemindersPage from "./features/tasks/RemindersPage";
import StreaksPage from "./features/tasks/StreaksPage";
import SettingsPage from "./features/accounts/SettingsPage";
import { getDashboardSummary } from "./features/tasks/dashboard";
import { isQuietHours } from "./features/tasks/reminders";
import { dashboardStats, formatScreenTime } from "./features/tasks/dashboardStats";
import type { Page, Pet, PetAction, Task, PlannerSettings } from "./types";

const starterTasks: Task[] = [
  { id: "task-1", title: "Plan your first study session", done: false },
  { id: "task-2", title: "Finish one small task", done: false },
  { id: "task-3", title: "Take a proper break", done: false },
];

const starterPet: Pet = {
  name: "Pixel",
  hunger: 35,
  happiness: 70,
  energy: 80,
  xp: 0,
  level: 1,
  avatar: "🐶",
  roomTheme: "lavender",
};

function load<T,>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function loadProgress(): PlannerProgress {
  const saved = load<Omit<PlannerProgress, "reward"> | null>("gencity-progress", null);
  const tasks = saved?.tasks ?? load("gencity-tasks", starterTasks);
  const pet = saved?.pet ?? load("gencity-pet", starterPet);
  // The chick was the original demo default, before companions were selectable.
  return { tasks, pet: pet.avatar === "🐣" ? { ...pet, avatar: "🐶" } : pet, activity: saved?.activity, xpHistory: saved?.xpHistory ?? load("gencity-xp-history", []), streakBonusMilestones: saved?.streakBonusMilestones ?? [] };
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "tasks", label: "Tasks", icon: "▤" },
  { id: "reminders", label: "Reminders", icon: "!" },
  { id: "streaks", label: "Streaks & XP", icon: "*" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "activity", label: "Activity", icon: "◷" },
  { id: "pet", label: "Pet room", icon: "♡" },
  { id: "friends", label: "Friends", icon: "♧" },
  { id: "account", label: "Settings", icon: "◉" },
];

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [progress, setProgress] = useState(loadProgress);
  const [settings, setSettings] = useState<PlannerSettings>(() => load("pcpet-settings", { remindersEnabled: true, browserNotifications: false, quietHoursEnabled: false, quietHoursStart: "22:00", quietHoursEnd: "08:00" }));
  const { tasks, pet, reward, activity, xpHistory = [] } = progress;
  const onCapture = useCallback((capture: ActivityCapture) => {
    const now = new Date();
    setProgress((current) => recordAppCapture(current, capture, now));
  }, []);
  const tracking = useActivityCapture(onCapture);

  useEffect(() => {
    localStorage.setItem("gencity-progress", JSON.stringify({ tasks, pet, activity, xpHistory, streakBonusMilestones: progress.streakBonusMilestones ?? [] }));
  }, [tasks, pet, activity, xpHistory, progress.streakBonusMilestones]);
  useEffect(() => { localStorage.setItem("pcpet-settings", JSON.stringify(settings)); }, [settings]);

  useEffect(() => {
    if (!settings.remindersEnabled || !settings.browserNotifications || !("Notification" in window) || Notification.permission !== "granted") return;
    const now = new Date();
    if (isQuietHours(now, settings.quietHoursEnabled, settings.quietHoursStart, settings.quietHoursEnd)) return;
    const due = tasks.filter((task) => !task.done && !task.notificationSentAt && task.dueAt && Date.parse(task.dueAt) <= now.getTime() && (!task.snoozedUntil || Date.parse(task.snoozedUntil) <= now.getTime()));
    for (const task of due) new Notification(`${pet.name}: ${task.title}`, { body: task.description || "A task is due." });
    if (due.length) setProgress((current) => ({ ...current, tasks: current.tasks.map((task) => due.some((item) => item.id === task.id) ? { ...task, notificationSentAt: now.toISOString() } : task) }));
  }, [tasks, pet.name, settings]);

  useEffect(() => {
    document.title = pet.hunger > 70 ? `${pet.name} needs a snack!` : "GenCity Pet Planner";
  }, [pet]);

  function completeTask(taskId: string) {
    setProgress((current) => toggleTaskProgress(current, taskId));
  }

  function addTask(task: Pick<Task, "title" | "description" | "dueAt">) {
    const newTask = { ...task, id: crypto.randomUUID(), done: false };
    setProgress((current) => ({ ...current, tasks: [...current.tasks, newTask] }));
  }

  function dismissTaskReminder(taskId: string) {
    setProgress((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === taskId ? { ...task, reminderDismissed: true } : task),
    }));
  }

  function snoozeTaskReminder(id: string, until: string) { setProgress((current) => ({ ...current, tasks: current.tasks.map((task) => task.id === id ? { ...task, snoozedUntil: until } : task) })); }

  function act(action: PetAction) {
    setProgress((current) => applyPetAction(current, action));
  }

  function renamePet(name: string) {
    setProgress((current) => ({ ...current, pet: { ...current.pet, name } }));
  }

  function customisePet(change: Partial<Pick<Pet, "avatar" | "roomTheme">>) {
    setProgress((current) => ({ ...current, pet: { ...current.pet, ...change } }));
  }

  function changeAppPreference(name: string, change: { rewards?: boolean; hidden?: boolean }) {
    const now = new Date();
    setProgress((current) => setAppPreference(current, name, change, now));
  }

  const completedCount = tasks.filter((task) => task.done).length;
  const now = new Date();
  const stats = dashboardStats(tasks, activity, now);
  const plannerSummary = getDashboardSummary(tasks, now);
  const screenTime = { day: activityDay(now), seconds: stats.activeSecondsToday };
  useScreenTimeSharing(screenTime);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">G</span><span>GENCITY<span className="brand-sub">FIRST YEAR HACK</span></span></div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className={page === item.id ? "nav-item active" : "nav-item"} onClick={() => setPage(item.id)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note"><span className="online-dot" /> Your little corner of campus</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div><p className="eyebrow">YOUR CAMPUS COMPANION</p><h1>{page === "home" ? "Good day, student." : navItems.find((item) => item.id === page)?.label}</h1></div>
          <div className="level-chip">LVL {pet.level} <span>✦</span></div>
        </header>

        <div role="status" aria-atomic="true" className={reward ? "xp-feedback" : undefined}>
          {reward && (
            <>
              <strong className="xp-feedback-amount">+{reward.amount} XP</strong>
              <div>
                <strong>{reward.levelReached ? `${pet.name || "Your pet"} reached level ${reward.levelReached}!` : reward.source === "activity" ? "App reward earned" : reward.source === "task" ? "Task reward earned" : "Playtime reward earned"}</strong>
                <p>{[reward.levelReached && "“We levelled up together!”", reward.detail, `${pet.xp} XP total`].filter(Boolean).join(" · ")}</p>
              </div>
            </>
          )}
        </div>

        {page === "home" && (
          <section className="dashboard-grid">
            <div className="welcome-card">
              <div><p className="eyebrow">TODAY'S CHECK-IN</p><h2>Small wins count.</h2><p>Finish a task, care for your companion, and keep your day moving.</p><button className="primary-button" onClick={() => setPage("tasks")}>See your tasks <span>↗</span></button></div>
              <div className="welcome-sparkle" aria-hidden="true">✦</div>
            </div>
            <div className="stat-card"><span className="stat-icon">✓</span><span className="stat-label">TASKS DONE</span><strong>{completedCount}<small> / {tasks.length}</small></strong><button className="text-button" onClick={() => setPage("tasks")}>Open task list →</button></div>
            <div className="pet-preview"><div><p className="eyebrow">YOUR COMPANION</p><h2>{pet.name}</h2><p>Level {pet.level} · {pet.xp} XP</p><button className="text-button" onClick={() => setPage("pet")}>Visit pet room →</button></div><div className="pet-emoji" aria-label={`${pet.name}, your pet`}>{pet.avatar ?? "🐶"}</div></div>
            <div className="next-card"><p className="eyebrow">STUDY STREAK · {plannerSummary.streak} DAYS</p><h3>{plannerSummary.nextTask ?? (plannerSummary.remaining ? "Add a deadline to see your next task." : "You're all caught up!")}</h3><button className="text-button" onClick={() => setPage("tasks")}>View today's plan →</button></div>
            <dl className="dashboard-activity content-card">
              <div><dt>Screen time today</dt><dd>{formatScreenTime(stats.activeSecondsToday)}</dd></div>
              <div><dt>Total screen time</dt><dd>{formatScreenTime(stats.activeSecondsTotal)}</dd></div>
              <div><dt>Best current streak</dt><dd>{stats.bestStreak} {stats.bestStreak === 1 ? "day" : "days"}</dd></div>
              <div><dt>Reminders completed</dt><dd>{stats.remindersCompleted}</dd></div>
            </dl>
          </section>
        )}

        {page === "tasks" && <TaskBoard tasks={tasks} onToggle={completeTask} onAdd={addTask} />}
        {page === "reminders" && <RemindersPage tasks={tasks} remindersEnabled={settings.remindersEnabled} onToggle={completeTask} onSnooze={snoozeTaskReminder} onDismiss={dismissTaskReminder} />}
        {page === "streaks" && <StreaksPage tasks={tasks} pet={pet} xpHistory={xpHistory} />}
        {page === "account" && <SettingsPage tasks={tasks} pet={pet} settings={settings} onSettingsChange={setSettings} onRenamePet={renamePet} onCustomisePet={customisePet} onDownloadData={(accountData) => { const blob = new Blob([JSON.stringify({ tasks, pet, activity, xpHistory, settings, accountData }, null, 2)], { type: "application/json" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "pc-pet-data.json"; link.click(); URL.revokeObjectURL(link.href); }} onDeleteData={() => { localStorage.clear(); location.reload(); }} />}
        {page === "calendar" && <CalendarPanel tasks={tasks} onViewTasks={() => setPage("tasks")} />}
        {page === "activity" && <ActivityPanel activity={activity} tracking={tracking} onPreference={changeAppPreference} />}
        {page === "pet" && <PetRoom pet={pet} onAction={act} onRename={renamePet} onCustomise={customisePet} onNavigate={setPage} />}
        {page === "friends" && <FriendsPanel screenTime={screenTime} />}

        <footer className="footer">Made for first years <span>✦</span></footer>
      </main>
      <TaskReminder tasks={tasks} pet={pet} settings={settings} onDismiss={dismissTaskReminder} onSnooze={snoozeTaskReminder} onViewTasks={() => setPage("tasks")} />
    </div>
  );
}
