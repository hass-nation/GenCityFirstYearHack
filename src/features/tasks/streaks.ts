import type { PlannerTask } from "./tasks.ts";

export function getCurrentStreak(tasks: readonly PlannerTask[], now: Date): number {
  const completionDays = new Set<string>();

  for (const task of tasks) {
    if (task.done && task.completedAt) {
      const completedAt = new Date(task.completedAt);
      if (completedAt.getTime() <= now.getTime()) completionDays.add(completedAt.toDateString());
    }
  }

  const day = new Date(now);
  if (!completionDays.has(day.toDateString())) day.setDate(day.getDate() - 1);

  let streak = 0;
  while (completionDays.has(day.toDateString())) {
    streak++;
    day.setDate(day.getDate() - 1);
  }

  return streak;
}

export function sampleStreaks(tasks: readonly PlannerTask[], now: Date): number {
  return getCurrentStreak(tasks, now);
}
