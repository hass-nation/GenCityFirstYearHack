import assert from "node:assert/strict";
import test from "node:test";
import { applyPetAction, toggleTaskProgress } from "../src/features/pet/progression.ts";

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
