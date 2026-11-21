import type { PlannerTask } from "./tasks.ts";

function completionDayKeys(tasks: readonly PlannerTask[], now: Date): string[] {
  const keys = new Set<string>();
  for (const task of tasks) {
    if (!task.done || !task.completedAt) continue;
    const completedAt = new Date(task.completedAt);
    if (!Number.isFinite(completedAt.getTime()) || completedAt.getTime() > now.getTime()) continue;
    keys.add(dayKey(completedAt));
  }
  return [...keys].sort();
}

export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getCurrentStreak(tasks: readonly PlannerTask[], now: Date): number {
  const completionDays = new Set(completionDayKeys(tasks, now));
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!completionDays.has(dayKey(day))) day.setDate(day.getDate() - 1);

  let streak = 0;
  while (completionDays.has(dayKey(day))) {
    streak++;
    day.setDate(day.getDate() - 1);
  }

  return streak;
}

export function getBestStreak(tasks: readonly PlannerTask[], now = new Date()): number {
  const days = completionDayKeys(tasks, now);
  let best = 0;
  let run = 0;
  let previous: Date | undefined;
  for (const key of days) {
    const [year, month, date] = key.split("-").map(Number);
    const current = new Date(year, month - 1, date);
    if (previous) {
      const dayDifference = Math.round((current.getTime() - previous.getTime()) / 86_400_000);
      run = dayDifference === 1 ? run + 1 : 1;
    } else {
      run = 1;
    }
    best = Math.max(best, run);
    previous = current;
  }
  return best;
}

export function getCompletionCountForDay(tasks: readonly PlannerTask[], date: Date): number {
  return tasks.filter((task) => task.done && task.completedAt && dayKey(new Date(task.completedAt)) === dayKey(date)).length;
}

export function sampleStreaks(tasks: readonly PlannerTask[], now: Date): number {
  return getCurrentStreak(tasks, now);
}
