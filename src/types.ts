export type Page = "home" | "tasks" | "calendar" | "activity" | "reminders" | "streaks" | "pet" | "friends" | "account";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  description?: string;
  dueAt?: string;
  completedAt?: string;
  reminderDismissed?: boolean;
  snoozedUntil?: string;
  notificationSentAt?: string;
  xpAwarded?: boolean;
};

export type XpEvent = { id: string; title: string; amount: number; source: "task" | "play" | "streak"; createdAt: string };
export type PlannerSettings = { remindersEnabled: boolean; browserNotifications: boolean; quietHoursEnabled: boolean; quietHoursStart: string; quietHoursEnd: string };

export type PetAction = "feed" | "play" | "rest";

export type Pet = {
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  xp: number;
  level: number;
  /** Optional so pets saved by older builds keep loading. */
  avatar?: string;
  roomTheme?: "lavender" | "meadow" | "sunset";
};
