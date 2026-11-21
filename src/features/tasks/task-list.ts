import type { PlannerTask } from "./tasks.ts";

export function getTaskList(tasks: readonly PlannerTask[]): PlannerTask[] {
  return tasks.filter((task) => !task.done);
}

export function sampleTaskList(tasks: readonly PlannerTask[]): string {
  return getTaskList(tasks).map((task) => task.title).join(", ");
}
