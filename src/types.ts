export type Page = "home" | "tasks" | "calendar" | "activity" | "pet" | "friends" | "messages" | "account";

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
export type BuiltInPet = "camel" | "cat" | "dog";
export type PetSpecies = BuiltInPet | "custom";
export type SpriteFrames = readonly [string, string];

export type Pet = {
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  xp: number;
  level: number;
  /** Optional so pets saved by older builds keep loading. */
  avatar?: string;
  species?: PetSpecies;
  customFrames?: SpriteFrames;
  roomTheme?: "lavender" | "meadow" | "sunset";
};
