import { getReminders } from "./reminders.ts";
import { getCurrentStreak } from "./streaks.ts";
import { getTaskList } from "./task-list.ts";
import type { PlannerTask } from "./tasks.ts";

export function getDashboardSummary(tasks: readonly PlannerTask[], now: Date) {
  const remaining = getTaskList(tasks).length;
  const [nextReminder] = getReminders(tasks, now);

  return {
    completed: tasks.length - remaining,
    remaining,
    nextTask: nextReminder?.title,
    streak: getCurrentStreak(tasks, now),
  };
}

export function sampleDashboard(tasks: readonly PlannerTask[], now: Date): string {
  const { completed, remaining, nextTask, streak } = getDashboardSummary(tasks, now);
  return `${completed} done, ${remaining} left, streak ${streak}, next: ${nextTask ?? "none"}`;
}
