import { useCallback, useEffect, useRef, useState } from "react";
import AccountPanel from "./features/accounts/AccountPanel";
import ActivityPanel from "./features/activity/ActivityPanel";
import { activityDay, dailyScreenTime, recordAppCapture, setAppPreference, type ActivityCapture } from "./features/activity/activity";
import { useActivityCapture } from "./features/activity/useActivityCapture";
import FriendsPanel from "./features/friends/FriendsPanel";
import MessagesPanel from "./features/friends/MessagesPanel";
import PetRoom from "./features/pet/PetRoom";
import PetSprite from "./features/pet/PetSprite";
import { DEFAULT_PET_NAME, migratePet, type AppearanceChange } from "./features/pet/appearance";
import { speakOnDesktop, useDesktopAppearance } from "./features/pet/desktopSync";
import { usePetBubbles } from "./features/pet/usePetBubbles";
import { toggleTaskProgress, XP_PER_LEVEL, type PlannerProgress } from "./features/pet/progression";
import TaskBoard from "./features/tasks/TaskBoard";
import TaskReminder from "./features/tasks/TaskReminder";
import CalendarPanel from "./features/tasks/CalendarPanel";
import { dashboardStats, formatScreenTime } from "./features/tasks/dashboardStats";
import type { Page, Pet, Task } from "./types";

const starterTasks: Task[] = [
  { id: "task-1", title: "Plan your first study session", done: false },
  { id: "task-2", title: "Finish one small task", done: false },
  { id: "task-3", title: "Take a proper break", done: false },
];

const starterPet: Pet = {
  name: DEFAULT_PET_NAME,
  hunger: 35,
  happiness: 70,
  energy: 80,
  xp: 0,
  level: 1,
  species: "camel",
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
  return { tasks, pet: migratePet(pet), activity: saved?.activity };
}

const navItems: { id: Page; label: string }[] = [
  { id: "home", label: "Dashboard" },
  { id: "tasks", label: "Tasks" },
  { id: "calendar", label: "Calendar" },
  { id: "activity", label: "Activity" },
  { id: "pet", label: "Pet room" },
  { id: "friends", label: "Create party" },
  { id: "messages", label: "Messages" },
  { id: "account", label: "Profile" },
];

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [progress, setProgress] = useState(loadProgress);
  const { tasks, pet, reward, activity } = progress;
  const previousLevel = useRef(pet.level);
  const [celebration, setCelebration] = useState<number>();
  useEffect(() => {
    const increased = pet.level > previousLevel.current;
    previousLevel.current = pet.level;
    if (!increased) return;
    setCelebration(pet.level);
    speakOnDesktop(`I leveled up! I’m level ${pet.level}!`, true);
  }, [pet.level]);
  useEffect(() => {
    if (celebration === undefined) return;
    const timer = window.setTimeout(() => setCelebration(undefined), 4800);
    return () => window.clearTimeout(timer);
  }, [celebration]);
  const onCapture = useCallback((capture: ActivityCapture) => {
    const now = new Date();
    setProgress((current) => recordAppCapture(current, capture, now));
  }, []);
  const tracking = useActivityCapture(onCapture);
  useDesktopAppearance(pet);
  const { inbox, bubble } = usePetBubbles(activity);

  useEffect(() => {
    localStorage.setItem("gencity-progress", JSON.stringify({ tasks, pet, activity }));
  }, [tasks, pet, activity]);

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

  function renamePet(name: string) {
    setProgress((current) => ({ ...current, pet: { ...current.pet, name } }));
  }

  function customisePet(change: AppearanceChange) {
    setProgress((current) => ({ ...current, pet: { ...current.pet, ...change } }));
  }

  function changeAppPreference(name: string, change: { rewards?: boolean; hidden?: boolean }) {
    const now = new Date();
    setProgress((current) => setAppPreference(current, name, change, now));
  }

  const completedCount = tasks.filter((task) => task.done).length;
  const now = new Date();
  const stats = dashboardStats(tasks, activity, now);
  const week = page === "home" ? dailyScreenTime(activity, now) : [];
  const chartMaximum = Math.max(1, ...week.map(({ seconds }) => seconds));
  const nextTasks = tasks.filter((task) => !task.done).slice(0, 3);
  const levelXp = pet.xp % XP_PER_LEVEL;

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand">
          <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true" fill="currentColor">
            <ellipse cx="8" cy="13" rx="2.5" ry="3.4" transform="rotate(-24 8 13)" />
            <ellipse cx="13.5" cy="8.5" rx="2.5" ry="3.5" />
            <ellipse cx="19.5" cy="8.5" rx="2.5" ry="3.5" />
            <ellipse cx="25" cy="13" rx="2.5" ry="3.4" transform="rotate(24 25 13)" />
            <path d="M16.5 14c3.4 0 4.3 3.1 7.3 5.9 2.8 2.8 1 6.1-2.2 6.1-2 0-3.2-1.2-5.1-1.2S13.4 26 11.4 26c-3.2 0-5-3.3-2.2-6.1 3-2.8 3.9-5.9 7.3-5.9Z" />
          </svg>
          <span>PC Pet</span>
        </div>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <button key={item.id} className="nav-item" aria-current={page === item.id ? "page" : undefined} onClick={() => setPage(item.id)}>
              {item.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main-content">
        <header className="topbar">
          <div>
            <h1>{navItems.find((item) => item.id === page)?.label}</h1>
            {page === "home" && <p className="dashboard-date">{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>}
          </div>
          {page === "home" && <button className="primary-button" onClick={() => setPage("tasks")}>Open tasks <span aria-hidden="true">↗</span></button>}
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
          <div className="dashboard-grid">
            <dl className="dashboard-metrics content-card">
              <div><dt>Tasks done</dt><dd>{completedCount}<small> / {tasks.length}</small></dd></div>
              <div><dt>Screen time today</dt><dd>{formatScreenTime(stats.activeSecondsToday)}</dd></div>
              <div><dt>Best streak</dt><dd>{stats.bestStreak} <small>{stats.bestStreak === 1 ? "day" : "days"}</small></dd></div>
              <div><dt>Reminders done</dt><dd>{stats.remindersCompleted}</dd></div>
            </dl>

            <section className="dashboard-screen-time content-card">
              <div className="dashboard-panel-heading">
                <div><h2>Screen time</h2><p>Last 7 days</p></div>
                <button className="text-button" onClick={() => setPage("activity")}>View activity <span aria-hidden="true">↗</span></button>
              </div>
              <ul className="week-chart" aria-label="Daily screen time" role="list">
                {week.map(({ date, seconds }, index) => (
                  <li key={activityDay(date)} className={index === week.length - 1 ? "chart-today" : undefined} title={formatScreenTime(seconds)}>
                    <span className="sr-only">{date.toLocaleDateString(undefined, { dateStyle: "full" })}: {formatScreenTime(seconds)}</span>
                    <div className="chart-column" aria-hidden="true"><span style={{ height: `${(seconds / chartMaximum) * 100}%` }} /></div>
                    <span className="chart-day" aria-hidden="true">{date.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  </li>
                ))}
              </ul>
              <div className="chart-summary">
                <span>{week.some(({ seconds }) => seconds > 0) ? `${formatScreenTime(week.reduce((total, day) => total + day.seconds, 0))} over 7 days` : "No screen time recorded this week."}</span>
                <span>Total <strong>{formatScreenTime(stats.activeSecondsTotal)}</strong></span>
              </div>
            </section>

            <section className="dashboard-pet content-card">
              <div className="dashboard-panel-heading"><h2>Your companion</h2><span className="pet-level">Level {pet.level}</span></div>
              <div className="companion-stage"><span className="companion-avatar"><PetSprite species={pet.species} customFrames={pet.customFrames} /></span></div>
              <div className="companion-details">
                <h3>{pet.name}</h3>
                <div className="dashboard-progress-label"><span>Level progress</span><span>{levelXp} / {XP_PER_LEVEL} XP</span></div>
                <progress aria-label="Pet level progress" max={XP_PER_LEVEL} value={levelXp} />
                <button className="companion-button" onClick={() => setPage("pet")}>Visit pet room <span aria-hidden="true">↗</span></button>
              </div>
            </section>

            <section className="dashboard-plan content-card">
              <div className="dashboard-panel-heading"><h2>Up next</h2><button className="text-button" onClick={() => setPage("calendar")}>Open calendar <span aria-hidden="true">↗</span></button></div>
              <div className="dashboard-progress-label"><span>Task progress</span><span>{completedCount} of {tasks.length} complete</span></div>
              <progress aria-label="Tasks completed" max={Math.max(1, tasks.length)} value={completedCount} />
              {nextTasks.length ? (
                <ul className="dashboard-task-list">
                  {nextTasks.map((task) => (
                    <li key={task.id}>
                      <button className="check-button" aria-label={`Complete ${task.title}`} onClick={() => completeTask(task.id)} />
                      <span>{task.title}</span>
                      {task.dueAt && <time dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>}
                    </li>
                  ))}
                </ul>
              ) : <p className="dashboard-empty">You're all caught up.</p>}
            </section>
          </div>
        )}

        {page === "tasks" && <TaskBoard tasks={tasks} onToggle={completeTask} onAdd={addTask} />}
        {page === "calendar" && <CalendarPanel tasks={tasks} onViewTasks={() => setPage("tasks")} />}
        {page === "activity" && <ActivityPanel activity={activity} tracking={tracking} onPreference={changeAppPreference} />}
        {page === "pet" && <PetRoom pet={pet} onRename={renamePet} onCustomise={customisePet} />}
        {page === "friends" && <FriendsPanel />}
        {page === "messages" && <MessagesPanel inbox={inbox} />}
        {page === "account" && <AccountPanel />}

      </main>
      <TaskReminder tasks={tasks} pet={pet} onDismiss={dismissTaskReminder} onViewTasks={() => setPage("tasks")} />
      {celebration !== undefined && <div className="pet-celebration" key={celebration}>
        <div className="pet-speech" role="status">I leveled up! I’m level {celebration}!</div>
        <PetSprite className="level-up-sprite" species={pet.species} customFrames={pet.customFrames} />
      </div>}
      <div role="status" className={bubble ? "pet-speech pet-popup" : undefined}>
        {bubble && <><strong>{pet.name}</strong><div>{bubble}</div></>}
      </div>
    </div>
  );
}
