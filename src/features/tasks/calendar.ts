import { activityDay } from "../activity/activity.ts";
import type { Task } from "../../types.ts";

export function scheduledTasks(tasks: readonly Task[]) {
  return tasks.flatMap((task) => {
    const date = new Date(task.dueAt ?? "");
    return Number.isFinite(date.getTime()) ? [{ task, date, day: activityDay(date) }] : [];
  }).sort((left, right) => left.date.getTime() - right.date.getTime());
}

export function monthDays(month: Date) {
  const year = month.getFullYear();
  const index = month.getMonth();
  const first = new Date(year, index, 1);
  const offset = (first.getDay() + 6) % 7;
  const length = new Date(year, index + 1, 0).getDate();
  return { offset, days: Array.from({ length }, (_, day) => new Date(year, index, day + 1)) };
}
