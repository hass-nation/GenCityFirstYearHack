import type { Task } from "../../types.ts";

export type PlannerTask = Task & {
  dueAt?: string;
  completedAt?: string;
};

export function createTask(id: string, title: string, dueAt?: Date): PlannerTask {
  return { id, title: title.trim(), done: false, dueAt: dueAt?.toISOString() };
}

export function completeTask(task: PlannerTask, completedAt: Date): PlannerTask {
  return task.done ? task : { ...task, done: true, completedAt: completedAt.toISOString() };
}

export function sampleTasks(): string {
  const task = createTask("sample", "Review lecture notes");
  const completed = completeTask(task, new Date("2026-11-21T12:00:00Z"));
  return `${completed.title} marked complete`;
}
