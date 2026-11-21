import type { Task } from "../../types.ts";
import { activityDay, getAppActivity, type ActivityState } from "../activity/activity.ts";
import { scheduledTasks } from "./calendar.ts";

export function dashboardStats(tasks: readonly Task[], activity: ActivityState | undefined, now: Date) {
  const today = activityDay(now);
  const entries = getAppActivity(activity, today).filter((entry) => !entry.hidden);
  const apps = entries.filter((entry) => !entry.website);
  return {
    activeSecondsToday: Math.floor(apps.reduce((ms, entry) => ms + entry.todayMs, 0) / 1000),
    activeSecondsTotal: Math.floor(apps.reduce((ms, entry) => ms + entry.totalMs, 0) / 1000),
    bestStreak: entries.reduce((days, entry) => Math.max(days, entry.streak), 0),
    remindersCompleted: scheduledTasks(tasks).filter(({ task }) => task.done).length,
  };
}

export function formatScreenTime(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
