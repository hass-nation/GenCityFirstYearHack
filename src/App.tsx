import { useEffect, useState } from "react";
import AccountPanel from "./features/accounts/AccountPanel";
import FriendsPage from "./features/friends/FriendsPage";
import PetRoom from "./features/pet/PetRoom";
import { toggleTaskProgress, type PlannerProgress } from "./features/pet/progression";
import TaskBoard from "./features/tasks/TaskBoard";
import TaskReminder from "./features/tasks/TaskReminder";
import type { Page, Pet, Task } from "./types";

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
  const saved = load<Pick<PlannerProgress, "tasks" | "pet"> | null>("gencity-progress", null);
  const tasks = saved?.tasks ?? load("gencity-tasks", starterTasks);
  const pet = saved?.pet ?? load("gencity-pet", starterPet);
  // The chick was the original demo default, before companions were selectable.
  return { tasks, pet: pet.avatar === "🐣" ? { ...pet, avatar: "🐶" } : pet };
}

const navItems: { id: Page; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "tasks", label: "Tasks", icon: "▤" },
  { id: "pet", label: "Customise", icon: "✦" },
  { id: "friends", label: "Friends", icon: "♡" },
  { id: "account", label: "Profile", icon: "◉" },
];

export default function App() {
  const [page, setPage] = useState<Page>("home");
  const [progress, setProgress] = useState(loadProgress);
  const { tasks, pet, reward } = progress;

  useEffect(() => {
    localStorage.setItem("gencity-progress", JSON.stringify({ tasks, pet }));
  }, [tasks, pet]);

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

  function customisePet(change: Partial<Pick<Pet, "avatar" | "roomTheme">>) {
    setProgress((current) => ({ ...current, pet: { ...current.pet, ...change } }));
  }

  const completedCount = tasks.filter((task) => task.done).length;

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
                <strong>{reward.levelReached ? `${pet.name || "Your pet"} reached level ${reward.levelReached}!` : reward.source === "task" ? "Task reward earned" : "Playtime reward earned"}</strong>
                <p>{reward.levelReached ? `“We levelled up together!” · ${pet.xp} XP total` : `${pet.xp} XP total`}</p>
              </div>
            </>
          )}
        </div>

        {page === "home" && (
          <section className="dashboard-grid">
            <div className="welcome-card">
              <div><p className="eyebrow">TODAY'S CHECK-IN</p><h2>Small wins count.</h2><p>Finish a task, care for your companion, and keep your day moving.</p><button className="primary-button" onClick={() => setPage("tasks")}>See your tasks <span>→</span></button></div>
              <div className="welcome-sparkle" aria-hidden="true">✦</div>
            </div>
            <div className="stat-card"><span className="stat-icon">✓</span><span className="stat-label">TASKS DONE</span><strong>{completedCount}<small> / {tasks.length}</small></strong><button className="text-button" onClick={() => setPage("tasks")}>Open task list →</button></div>
            <div className="pet-preview"><div><p className="eyebrow">YOUR COMPANION</p><h2>{pet.name}</h2><p>Level {pet.level} · {pet.xp} XP</p><button className="text-button" onClick={() => setPage("pet")}>Customise your pet →</button></div><div className="pet-emoji" aria-label={`${pet.name}, your pet`}>{pet.avatar ?? "🐶"}</div></div>
            <div className="next-card"><p className="eyebrow">A QUICK REMINDER</p><h3>{tasks.find((task) => !task.done)?.title ?? "You're all caught up!"}</h3><button className="text-button" onClick={() => setPage("tasks")}>View today's plan →</button></div>
          </section>
        )}

        {page === "tasks" && <TaskBoard tasks={tasks} onToggle={completeTask} onAdd={addTask} />}
        {page === "pet" && <PetRoom pet={pet} onRename={renamePet} onCustomise={customisePet} />}
        {page === "friends" && <FriendsPage />}
        {page === "account" && <AccountPanel />}

        <footer className="footer">Made for first years <span>✦</span></footer>
      </main>
      <TaskReminder tasks={tasks} pet={pet} onDismiss={dismissTaskReminder} onViewTasks={() => setPage("tasks")} />
    </div>
  );
}
