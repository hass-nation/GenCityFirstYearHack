import { getTaskList } from "./task-list.ts";
import type { PlannerTask } from "./tasks.ts";
import type { Task } from "../../types.ts";

export function getNextTaskReminder(tasks: readonly Task[], now: number): Task | undefined {
  let next: Task | undefined;
  let earliest = Infinity;
  for (const task of tasks) {
    if (task.done || task.reminderDismissed || !task.dueAt) continue;
    const due = Date.parse(task.dueAt);
    if (due <= now && due < earliest) {
      next = task;
      earliest = due;
    }
  }
  return next;
}

type Reminder = {
  title: string;
  dueAt: Date;
};

export function getReminders(tasks: readonly PlannerTask[]): Reminder[] {
  const reminders: Reminder[] = [];

  for (const task of getTaskList(tasks)) {
    if (task.dueAt) {
      const dueAt = new Date(task.dueAt);
      if (Number.isFinite(dueAt.getTime())) reminders.push({ title: task.title, dueAt });
    }
  }

  return reminders.sort((first, second) => first.dueAt.getTime() - second.dueAt.getTime());
}

export function sampleReminders(tasks: readonly PlannerTask[]): string {
  return getReminders(tasks).map((reminder) => reminder.title).join(", ");
}
