import { getTaskList } from "./task-list.ts";
import type { PlannerTask } from "./tasks.ts";

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
