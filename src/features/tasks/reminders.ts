import { getTaskList } from "./task-list.ts";
import type { PlannerTask } from "./tasks.ts";
import type { Task } from "../../types.ts";
import { dayKey } from "./streaks.ts";

export function getNextTaskReminder(tasks: readonly Task[], now: number): Task | undefined {
  let next: Task | undefined;
  let earliest = Infinity;
  for (const task of tasks) {
    if (task.done || task.reminderDismissed || !task.dueAt || (task.snoozedUntil && Date.parse(task.snoozedUntil) > now)) continue;
    const due = Date.parse(task.dueAt);
    if (due <= now && due < earliest) {
      next = task;
      earliest = due;
    }
  }
  return next;
}

export function isQuietHours(now: Date, enabled: boolean, start: string, end: string): boolean {
  if (!enabled) return false;
  const parse = (value: string) => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return undefined;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    return hour < 24 && minute < 60 ? hour * 60 + minute : undefined;
  };
  const startMinute = parse(start);
  const endMinute = parse(end);
  if (startMinute === undefined || endMinute === undefined || startMinute === endMinute) return false;
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  return startMinute < endMinute
    ? currentMinute >= startMinute && currentMinute < endMinute
    : currentMinute >= startMinute || currentMinute < endMinute;
}

type Reminder = {
  id: string;
  title: string;
  dueAt: Date;
  task: PlannerTask;
};

export type ReminderSection = "overdue" | "today" | "later";
export type CategorisedReminder = Reminder & { section: ReminderSection; snoozedUntil?: Date };

export function getReminderSections(tasks: readonly PlannerTask[], now = new Date()): Record<ReminderSection, CategorisedReminder[]> {
  const sections: Record<ReminderSection, CategorisedReminder[]> = { overdue: [], today: [], later: [] };
  const todayKey = dayKey(now);
  for (const task of getTaskList(tasks)) {
    if (task.reminderDismissed || !task.dueAt) continue;
    const dueAt = new Date(task.dueAt);
    if (!Number.isFinite(dueAt.getTime())) continue;
    const section: ReminderSection = dueAt.getTime() < now.getTime()
      ? "overdue"
      : dayKey(dueAt) === todayKey ? "today" : "later";
    const snoozedUntil = task.snoozedUntil ? new Date(task.snoozedUntil) : undefined;
    sections[section].push({ id: task.id, title: task.title, dueAt, task, section, ...(snoozedUntil && Number.isFinite(snoozedUntil.getTime()) ? { snoozedUntil } : {}) });
  }
  for (const items of Object.values(sections)) items.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
  return sections;
}

export function getReminders(tasks: readonly PlannerTask[], now = new Date()): Reminder[] {
  const reminders: Reminder[] = [];

  for (const task of getTaskList(tasks)) {
    if (task.reminderDismissed || (task.snoozedUntil && Date.parse(task.snoozedUntil) > now.getTime())) continue;
    if (task.dueAt) {
      const dueAt = new Date(task.dueAt);
      if (Number.isFinite(dueAt.getTime())) reminders.push({ id: task.id, title: task.title, dueAt, task });
    }
  }

  return reminders.sort((first, second) => first.dueAt.getTime() - second.dueAt.getTime());
}

export function sampleReminders(tasks: readonly PlannerTask[]): string {
  return getReminders(tasks, new Date(0)).map((reminder) => reminder.title).join(", ");
}
