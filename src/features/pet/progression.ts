import type { Pet, PetAction, Task } from "../../types.ts";
import type { ActivityState } from "../activity/activity.ts";

export const TASK_XP = 20;
export const PLAY_XP = 5;
export const XP_PER_LEVEL = 100;
export const PLAY_ENERGY = 15;

export type XpReward = {
  amount: number;
  source: "task" | "play" | "activity";
  levelReached?: number;
  detail?: string;
};

export type PlannerProgress = {
  tasks: Task[];
  pet: Pet;
  reward?: XpReward;
  activity?: ActivityState;
};

export function awardXp(pet: Pet, source: XpReward["source"], amount: number, detail?: string) {
  const xp = pet.xp + amount;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const reward: XpReward = { amount, source };
  if (detail) reward.detail = detail;
  if (level > pet.level) reward.levelReached = level;
  return { pet: { ...pet, xp, level }, reward };
}

export function toggleTaskProgress(state: PlannerProgress, id: string, now = new Date()): PlannerProgress {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return state;

  const alreadyAwarded = task.done || task.xpAwarded;
  const completed = !task.done;
  const toggled = { ...task, done: completed, completedAt: completed ? now.toISOString() : undefined, xpAwarded: true };
  const tasks = state.tasks.map((item) => item.id === id ? toggled : item);
  if (!toggled.done) return { ...state, tasks };

  const pet = { ...state.pet, happiness: Math.min(100, state.pet.happiness + 5) };
  if (alreadyAwarded) return { ...state, tasks, pet };
  return { ...state, tasks, ...awardXp(pet, "task", TASK_XP) };
}

export function applyPetAction(state: PlannerProgress, action: PetAction): PlannerProgress {
  const { pet } = state;
  if (action === "feed") {
    return { ...state, pet: { ...pet, hunger: Math.max(0, pet.hunger - 25), happiness: Math.min(100, pet.happiness + 5) } };
  }
  if (action === "rest") {
    return { ...state, pet: { ...pet, energy: Math.min(100, pet.energy + 25) } };
  }
  if (pet.energy < PLAY_ENERGY) return state;

  return {
    ...state,
    ...awardXp({ ...pet, happiness: Math.min(100, pet.happiness + 15), energy: pet.energy - PLAY_ENERGY }, "play", PLAY_XP),
  };
}
