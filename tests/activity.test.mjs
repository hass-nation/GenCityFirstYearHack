import assert from "node:assert/strict";
import test from "node:test";
import { activityDay, getAppActivity, recordAppCapture, setAppPreference } from "../src/features/activity/activity.ts";

const pet = { name: "Pixel", xp: 90, level: 1, hunger: 35, happiness: 70, energy: 80 };
const clock = (day, hour = 12, minute = 0) => new Date(2026, 10, day, hour, minute);
const sample = (day, name = "anki", length = 10) => ({ apps: [{ name, sessions: [{
  start: clock(day).toISOString(), end: clock(day, 12, length).toISOString(),
}] }] });

test("discovers apps and awards once per local day after opting in", () => {
  const today = clock(20, 13);
  let state = recordAppCapture({ tasks: [], pet }, sample(20), today);
  let [app] = getAppActivity(state.activity, activityDay(today));
  assert.equal(app.name, "anki");
  assert.equal(app.todayMs, 600000);
  assert.equal(state.pet.xp, 90);
  state = setAppPreference(state, "anki", { rewards: true }, today);
  assert.equal(state.pet.xp, 100);
  assert.equal(state.pet.level, 2);
  assert.equal(recordAppCapture(state, sample(20), today).pet.xp, 100);
  state = setAppPreference(state, "anki", { rewards: false }, today);
  state = setAppPreference(state, "anki", { rewards: true }, today);
  assert.equal(state.pet.xp, 100);
});

test("awards a third-day bonus and stops collecting hidden apps", () => {
  let state = recordAppCapture({ tasks: [], pet }, sample(18), clock(18, 13));
  state = setAppPreference(state, "anki", { rewards: true }, clock(18, 13));
  state = recordAppCapture(state, sample(19), clock(19, 13));
  state = recordAppCapture(state, sample(20), clock(20, 13));
  const [app] = getAppActivity(state.activity, activityDay(clock(20)));
  assert.equal(app.streak, 3);
  assert.equal(app.earnedXp, 35);
  assert.equal(state.pet.xp, 125);
  state = setAppPreference(state, "anki", { hidden: true }, clock(20, 13));
  state = recordAppCapture(state, sample(21), clock(21, 13));
  assert.equal(state.activity.apps.anki.days[activityDay(clock(21))], undefined);
  assert.equal(state.pet.xp, 125);
});

test("splits a foreground session at midnight and clips replayed time", () => {
  const capture = { apps: [{name: "code", sessions: [{
    start: clock(20, 23, 55).toISOString(), end: clock(21, 0, 5).toISOString(),
  }]}] };
  let state = recordAppCapture({tasks: [], pet}, capture, clock(21, 0, 6));
  state = recordAppCapture(state, capture, clock(21, 0, 7));
  const [app] = getAppActivity(state.activity, activityDay(clock(21)));
  assert.equal(app.todayMs, 300000);
  assert.equal(app.recentMs, 600000);
});

test("ranks apps by time today, breaking ties by seven-day usage", () => {
  const today = activityDay(clock(21));
  const yesterday = activityDay(clock(20));
  const rows = getAppActivity({ apps: {
    chrome: { days: { [yesterday]: 90_000 }, awards: {} },
    code: { days: { [today]: 30_000 }, awards: {} },
    anki: { days: { [today]: 30_000, [yesterday]: 1_000 }, awards: {} },
  }, capturedThrough: 0 }, today);
  assert.deepEqual(rows.map((row) => row.name), ["anki", "code", "chrome"]);
});
