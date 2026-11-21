export type Page = "home" | "tasks" | "calendar" | "activity" | "pet" | "friends" | "account";

export type Task = {
  id: string;
  title: string;
  done: boolean;
  description?: string;
  dueAt?: string;
  reminderDismissed?: boolean;
  xpAwarded?: boolean;
};

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
