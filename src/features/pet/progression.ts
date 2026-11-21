import type { Pet, PetAction, Task } from "../../types.ts";

export const TASK_XP = 20;
export const PLAY_XP = 5;
export const XP_PER_LEVEL = 100;
export const PLAY_ENERGY = 15;

export type XpReward = {
  amount: number;
  source: "task" | "play";
  levelReached?: number;
};

export type PlannerProgress = {
  tasks: Task[];
  pet: Pet;
  reward?: XpReward;
};

function awardXp(pet: Pet, source: XpReward["source"]) {
  const amount = source === "task" ? TASK_XP : PLAY_XP;
  const xp = pet.xp + amount;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const reward: XpReward = { amount, source };
  if (level > pet.level) reward.levelReached = level;
  return { pet: { ...pet, xp, level }, reward };
}

export function toggleTaskProgress(state: PlannerProgress, id: string): PlannerProgress {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return state;

  const alreadyAwarded = task.done || task.xpAwarded;
  const toggled = { ...task, done: !task.done, xpAwarded: true };
  const tasks = state.tasks.map((item) => item.id === id ? toggled : item);
  if (!toggled.done) return { ...state, tasks };

  const pet = { ...state.pet, happiness: Math.min(100, state.pet.happiness + 5) };
  if (alreadyAwarded) return { ...state, tasks, pet };
  return { tasks, ...awardXp(pet, "task") };
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
    ...awardXp({ ...pet, happiness: Math.min(100, pet.happiness + 15), energy: pet.energy - PLAY_ENERGY }, "play"),
  };
}
