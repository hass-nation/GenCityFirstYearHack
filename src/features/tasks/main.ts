import { sampleDashboard } from "./dashboard.ts";
import { sampleReminders } from "./reminders.ts";
import { sampleSmartReminders } from "./smart-reminders.ts";
import { sampleStreaks } from "./streaks.ts";
import { sampleTaskList } from "./task-list.ts";
import { completeTask, createTask, sampleTasks } from "./tasks.ts";

const now = new Date("2026-11-21T12:00:00Z");
const tasks = [
  completeTask(createTask("1", "Read chapter 2"), new Date("2026-11-20T12:00:00Z")),
  completeTask(createTask("2", "Make revision cards"), now),
  createTask("3", "Submit lab notes", new Date("2026-11-21T17:00:00Z")),
  createTask("4", "Outline the essay", new Date("2026-11-24T12:00:00Z")),
];

console.log("Tasks:", sampleTasks());
console.log("Reminders:", sampleReminders(tasks));
console.log("Streaks:", sampleStreaks(tasks, now));
console.log("Dashboard:", sampleDashboard(tasks, now));
console.log("Task List:", sampleTaskList(tasks));
console.log("Smart Reminders:", sampleSmartReminders(tasks, now));
