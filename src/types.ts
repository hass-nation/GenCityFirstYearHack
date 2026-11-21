export type Page = "home" | "tasks" | "pet" | "account";

export type Task = {
  id: string;
  title: string;
  done: boolean;
};

export type PetAction = "feed" | "play" | "rest";

export type Pet = {
  name: string;
  hunger: number;
  happiness: number;
  energy: number;
  xp: number;
  level: number;
};
