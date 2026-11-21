import { getReminders } from "./reminders.ts";
import type { PlannerTask } from "./tasks.ts";

const oneDayMs = 24 * 60 * 60 * 1000;

export function getSmartReminder(tasks: readonly PlannerTask[], now: Date): string | undefined {
  const [nextReminder] = getReminders(tasks);
  if (!nextReminder) return undefined;

  const timeUntilDue = nextReminder.dueAt.getTime() - now.getTime();
  if (timeUntilDue < 0) return `Overdue: ${nextReminder.title}`;
  if (timeUntilDue <= oneDayMs) return `Due within 24 hours: ${nextReminder.title}`;
  return undefined;
}

export function sampleSmartReminders(tasks: readonly PlannerTask[], now: Date): string {
  return getSmartReminder(tasks, now) ?? "No urgent tasks";
}
