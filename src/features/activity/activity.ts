import { awardXp, type PlannerProgress } from "../pet/progression.ts";

export const QUALIFYING_MINUTES = 10;
export const DAILY_APP_XP = 10;
export const STREAK_BONUS_XP = 5;
export const BONUS_START_DAY = 3;
const QUALIFYING_MS = QUALIFYING_MINUTES * 60_000;

type AppActivity = {
  days: Record<string, number>;
  awards: Record<string, number>;
  rewardsSince?: string;
  hidden?: boolean;
};

export type ActivityState = { apps: Record<string, AppActivity>; capturedThrough: number };
export type ActivityCapture = { apps: { name: string; sessions: { start: string; end: string }[] }[] };

const emptyActivity: ActivityState = { apps: {}, capturedThrough: 0 };

export function activityDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function moveDay(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return activityDay(date);
}

function streakThrough(app: AppActivity, day: string) {
  let streak = 0;
  while (app.rewardsSince && day >= app.rewardsSince && app.days[day] >= QUALIFYING_MS) {
    streak++;
    day = moveDay(day, -1);
  }
  return streak;
}

export function getAppActivity(activity: ActivityState | undefined, today: string) {
  const weekStart = moveDay(today, -6);
  return Object.entries(activity?.apps ?? {}).map(([name, app]) => ({
    name,
    hidden: app.hidden ?? false,
    rewards: Boolean(app.rewardsSince),
    todayMs: app.days[today] ?? 0,
    recentMs: Object.entries(app.days).reduce((total, [day, ms]) => day >= weekStart && day <= today ? total + ms : total, 0),
    streak: streakThrough(app, app.days[today] >= QUALIFYING_MS ? today : moveDay(today, -1)),
    earnedXp: Object.values(app.awards).reduce((total, xp) => total + xp, 0),
    earnedToday: app.awards[today] ?? 0,
  })).sort((left, right) => right.todayMs - left.todayMs || right.recentMs - left.recentMs || left.name.localeCompare(right.name));
}

function settle(state: PlannerProgress, activity: ActivityState, candidates: Map<string, Set<string>>): PlannerProgress {
  let total = 0;
  const apps = [];
  for (const [name, days] of candidates) {
    const app = activity.apps[name];
    if (!app.rewardsSince || app.hidden) continue;
    for (const day of days) {
      if (app.awards[day]) continue;
      const streak = streakThrough(app, day);
      if (!streak) continue;
      const xp = DAILY_APP_XP + (streak >= BONUS_START_DAY ? STREAK_BONUS_XP : 0);
      app.awards = { ...app.awards, [day]: xp };
      total += xp;
      apps.push({ name, streak });
    }
  }
  if (!total) return { ...state, activity };
  const detail = apps.length === 1
    ? `${apps[0].name} · ${apps[0].streak}-day streak`
    : `${apps.length} app-day rewards earned`;
  return { ...state, activity, ...awardXp(state.pet, "activity", total, detail) };
}

export function recordAppCapture(state: PlannerProgress, capture: ActivityCapture, now: Date): PlannerProgress {
  const previous = state.activity ?? emptyActivity;
  const apps: ActivityState["apps"] = Object.assign(Object.create(null), previous.apps);
  let capturedThrough = previous.capturedThrough;
  const candidates = new Map<string, Set<string>>();
  const sessions = capture.apps.flatMap(({ name, sessions }) => sessions.map(({ start, end }) => ({
    name, start: Date.parse(start), end: Date.parse(end),
  }))).sort((left, right) => left.start - right.start);

  for (const session of sessions) {
    let start = Math.max(session.start, capturedThrough);
    // The capture clock is local, but allow minor skew between the browser and sampler.
    const end = Math.min(session.end, now.getTime());
    if (!(start < end) || typeof session.name !== "string" || !session.name.trim()) continue;
    capturedThrough = end;
    const existing = apps[session.name];
    if (existing?.hidden) continue;

    const app: AppActivity = existing
      ? { ...existing, days: { ...existing.days } }
      : { days: {}, awards: {} };
    const days = candidates.get(session.name) ?? new Set<string>();
    while (start < end) {
      const boundary = new Date(start);
      const day = activityDay(boundary);
      boundary.setHours(24, 0, 0, 0);
      const until = Math.min(end, boundary.getTime());
      app.days[day] = (app.days[day] ?? 0) + until - start;
      days.add(day);
      start = until;
    }
    apps[session.name] = app;
    candidates.set(session.name, days);
  }

  return capturedThrough === previous.capturedThrough ? state : settle(state, { apps, capturedThrough }, candidates);
}

export function setAppPreference(state: PlannerProgress, name: string, change: { rewards?: boolean; hidden?: boolean }, now: Date): PlannerProgress {
  const activity = state.activity;
  if (!activity || !Object.hasOwn(activity.apps, name)) return state;
  const today = activityDay(now);
  const app = { ...activity.apps[name] };
  if (change.rewards !== undefined) app.rewardsSince = change.rewards ? app.rewardsSince ?? today : undefined;
  if (change.hidden !== undefined) app.hidden = change.hidden;
  return settle(state, { ...activity, apps: { ...activity.apps, [name]: app } }, new Map([[name, new Set([today])]]));
}
