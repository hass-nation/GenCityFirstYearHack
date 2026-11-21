import type { Pet, PetAction, Task, XpEvent } from "../../types.ts";
import { getCurrentStreak } from "../tasks/streaks.ts";
import type { ActivityState } from "../activity/activity.ts";

export const TASK_XP = 20;
export const PLAY_XP = 5;
export const XP_PER_LEVEL = 100;
export const PLAY_ENERGY = 15;

export type XpReward = {
  amount: number;
  source: "task" | "play" | "streak" | "activity";
  levelReached?: number;
  detail?: string;
};

export type PlannerProgress = {
  tasks: Task[];
  pet: Pet;
  reward?: XpReward;
  xpHistory?: XpEvent[];
  streakBonusMilestones?: number[];
  activity?: ActivityState;
};

const STREAK_MILESTONES = [3, 7, 14] as const;
const STREAK_BONUS_XP = 10;

export function awardXp(pet: Pet, source: XpReward["source"], amount: number, detail?: string) {
  const xp = pet.xp + amount;
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const reward: XpReward = { amount, source, ...(level > pet.level ? { levelReached: level } : {}), ...(detail ? { detail } : {}) };
  return { pet: { ...pet, xp, level }, reward, levelReached: reward.levelReached };
}

function addXpEvents(state: PlannerProgress, events: XpEvent[]) {
  return [...(state.xpHistory ?? []), ...events].slice(-100);
}

export function toggleTaskProgress(state: PlannerProgress, id: string, now = new Date()): PlannerProgress {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) return state;

  const alreadyAwarded = task.done || task.xpAwarded;
  const completed = !task.done;
  const toggled: Task = completed
    ? { ...task, done: true, completedAt: now.toISOString(), xpAwarded: true }
    : { ...task, done: false, completedAt: undefined, xpAwarded: true };
  const tasks = state.tasks.map((item) => item.id === id ? toggled : item);
  if (!completed) return { ...state, tasks };

  const happyPet = { ...state.pet, happiness: Math.min(100, state.pet.happiness + 5) };
  const events: XpEvent[] = [];
  let amount = 0;
  if (!alreadyAwarded) {
    amount += TASK_XP;
    events.push({ id: `task-${id}-${now.getTime()}`, title: task.title, amount: TASK_XP, source: "task", createdAt: now.toISOString() });
  }

  const streak = getCurrentStreak(tasks, now);
  const paid = state.streakBonusMilestones ?? [];
  const earned = STREAK_MILESTONES.filter((milestone) => streak >= milestone && !paid.includes(milestone));
  for (const milestone of earned) {
    amount += STREAK_BONUS_XP;
    events.push({ id: `streak-${milestone}-${now.getTime()}`, title: `${milestone}-day streak bonus`, amount: STREAK_BONUS_XP, source: "streak", createdAt: now.toISOString() });
  }

  if (amount === 0) return { ...state, tasks, pet: happyPet, streakBonusMilestones: paid };
  const source = earned.length > 0 && alreadyAwarded ? "streak" : "task";
  const { pet, levelReached } = awardXp(happyPet, source, amount);
  return {
    ...state,
    tasks,
    pet,
    xpHistory: addXpEvents(state, events),
    streakBonusMilestones: [...new Set([...paid, ...earned])],
    reward: { amount, source, ...(levelReached === undefined ? {} : { levelReached }) },
  };
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

  const happyPet = { ...pet, happiness: Math.min(100, pet.happiness + 15), energy: pet.energy - PLAY_ENERGY };
  const { pet: nextPet, levelReached } = awardXp(happyPet, "play", PLAY_XP);
  const now = new Date();
  const event: XpEvent = { id: `play-${now.getTime()}`, title: "Played with your pet", amount: PLAY_XP, source: "play", createdAt: now.toISOString() };
  return {
    ...state,
    pet: nextPet,
    xpHistory: addXpEvents(state, [event]),
    reward: { amount: PLAY_XP, source: "play", ...(levelReached === undefined ? {} : { levelReached }) },
  };
}

