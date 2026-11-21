import assert from "node:assert/strict";
import test from "node:test";
import { applyPetAction, toggleTaskProgress } from "../src/features/pet/progression.ts";
import { getBestStreak, getCurrentStreak } from "../src/features/tasks/streaks.ts";
import { getReminderSections, getReminders, isQuietHours } from "../src/features/tasks/reminders.ts";
import { getDashboardSummary } from "../src/features/tasks/dashboard.ts";

function planner({ done = false, energy = 15, xp = 80 } = {}) {
  return {
    pet: { name: "Pixel", hunger: 35, happiness: 70, energy, xp, level: 1 },
    tasks: [{ id: "task", title: "Study", done }],
  };
}

test("first task completion awards XP and a level, even after reopening and reloading", () => {
  const completed = toggleTaskProgress(planner(), "task");
  assert.equal(completed.pet.xp, 100);
  assert.equal(completed.pet.level, 2);
  assert.deepEqual(completed.reward, { amount: 20, source: "task", levelReached: 2 });

  const reopened = toggleTaskProgress(completed, "task");
  assert.equal(reopened.tasks[0].done, false);
  const saved = JSON.parse(JSON.stringify({ tasks: reopened.tasks, pet: reopened.pet }));
  const repeated = toggleTaskProgress(saved, "task");
  assert.equal(repeated.tasks[0].done, true);
  assert.equal(repeated.pet.xp, 100);
  assert.equal(repeated.reward, undefined);
});

test("completing and reopening a task records and clears its completion time", () => {
  const now = new Date("2026-11-19T12:30:00");
  const completed = toggleTaskProgress(planner(), "task", now);
  assert.equal(completed.tasks[0].completedAt, now.toISOString());
  const reopened = toggleTaskProgress(completed, "task", new Date("2026-11-20T08:00:00"));
  assert.equal(reopened.tasks[0].completedAt, undefined);
  assert.equal(reopened.tasks[0].xpAwarded, true);
});

test("streak milestone bonuses are awarded once and completion dates drive streaks", () => {
  const dates = ["2026-11-18T10:00:00", "2026-11-19T10:00:00", "2026-11-20T10:00:00"];
  let state = planner({ xp: 0 });
  state.tasks = dates.map((_, index) => ({ id: `task-${index}`, title: `Task ${index}`, done: false }));
  dates.forEach((date, index) => { state = toggleTaskProgress(state, `task-${index}`, new Date(date)); });

  assert.equal(getCurrentStreak(state.tasks, new Date("2026-11-20T23:00:00")), 3);
  assert.equal(getBestStreak(state.tasks, new Date("2026-11-20T23:00:00")), 3);
  assert.equal(state.pet.xp, 70);
  assert.deepEqual(state.streakBonusMilestones, [3]);
  assert.equal(state.xpHistory.filter((event) => event.source === "streak").length, 1);

  state = toggleTaskProgress(state, "task-2", new Date("2026-11-20T11:00:00"));
  state = toggleTaskProgress(state, "task-2", new Date("2026-11-20T12:00:00"));
  assert.equal(state.pet.xp, 70);
  assert.equal(state.xpHistory.filter((event) => event.source === "streak").length, 1);
});

test("reminders are grouped by due time and snoozed items stay listed but do not trigger", () => {
  const now = new Date(2026, 10, 21, 12, 0, 0);
  const due = (hour, dayOffset = 0) => {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, 0, 0, 0);
    return date.toISOString();
  };
  const tasks = [
    { id: "later", title: "Later", done: false, dueAt: due(10, 1) },
    { id: "today", title: "Today", done: false, dueAt: due(18) },
    { id: "overdue", title: "Overdue", done: false, dueAt: due(10) },
    { id: "snoozed", title: "Snoozed", done: false, dueAt: due(11), snoozedUntil: due(13) },
  ];
  const sections = getReminderSections(tasks, now);
  assert.deepEqual(sections.overdue.map((item) => item.id), ["overdue", "snoozed"]);
  assert.deepEqual(sections.today.map((item) => item.id), ["today"]);
  assert.deepEqual(sections.later.map((item) => item.id), ["later"]);
  assert.deepEqual(getReminders(tasks, now).map((item) => item.id), ["overdue", "today", "later"]);
  assert.deepEqual(getReminders(tasks, new Date(2026, 10, 21, 14, 0, 0)).map((item) => item.id), ["overdue", "snoozed", "today", "later"]);
});

test("quiet hours support ranges that cross midnight", () => {
  assert.equal(isQuietHours(new Date(2026, 10, 21, 23, 0), true, "22:00", "08:00"), true);
  assert.equal(isQuietHours(new Date(2026, 10, 21, 7, 59), true, "22:00", "08:00"), true);
  assert.equal(isQuietHours(new Date(2026, 10, 21, 12, 0), true, "22:00", "08:00"), false);
  assert.equal(isQuietHours(new Date(2026, 10, 21, 23, 0), false, "22:00", "08:00"), false);
});

test("home summary uses the earliest active deadline and the current streak", () => {
  const now = new Date(2026, 10, 21, 12, 0, 0);
  const tasks = [
    { id: "late", title: "Later deadline", done: false, dueAt: new Date(2026, 10, 23, 12).toISOString() },
    { id: "early", title: "Soonest deadline", done: false, dueAt: new Date(2026, 10, 22, 12).toISOString() },
    { id: "done", title: "Completed", done: true, completedAt: new Date(2026, 10, 21, 10).toISOString(), dueAt: new Date(2026, 10, 21, 11).toISOString() },
  ];
  assert.deepEqual(getDashboardSummary(tasks, now), { completed: 1, remaining: 2, nextTask: "Soonest deadline", streak: 1 });
});

test("previously completed tasks without a reward marker cannot earn XP again", () => {
  const reopened = toggleTaskProgress(planner({ done: true }), "task");
  assert.equal(toggleTaskProgress(reopened, "task").pet.xp, 80);
});

test("playing consumes a full play charge and cannot award XP again until rested", () => {
  const tired = planner({ energy: 14, xp: 95 });
  assert.equal(applyPetAction(tired, "play"), tired);

  const ready = planner({ xp: 95 });
  const played = applyPetAction(ready, "play");
  assert.equal(played.pet.energy, 0);
  assert.equal(played.pet.xp, 100);
  assert.equal(played.pet.level, 2);
  assert.deepEqual(played.reward, { amount: 5, source: "play", levelReached: 2 });
  assert.equal(applyPetAction(played, "play"), played);
  assert.equal(applyPetAction(applyPetAction(played, "rest"), "play").pet.xp, 105);
});
