import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("the website extension exposes only a focused public domain to the approved planner", async () => {
  let listener;
  let tab = { id: 8, url: "https://school.example/assignment?private=1", incognito: false };
  let focused = true;
  const event = { addListener() {} };
  const chrome = {
    tabs: { onActivated: event, onUpdated: event, query: async () => [tab] },
    windows: { onFocusChanged: event, getLastFocused: async () => ({ id: 1, focused }) },
    runtime: { onMessage: { addListener(handler) { listener = handler; } } },
    storage: { local: { get: async () => ({ plannerOrigin: "http://localhost:5000" }) } },
  };
  vm.runInNewContext(readFileSync(new URL("../browser_activity/worker.js", import.meta.url), "utf8"), { chrome, URL, navigator: { userAgent: "Chrome" } });
  const sample = (url) => new Promise((resolve) => listener({ type: "sample-site" }, { url }, resolve));
  assert.equal(await sample("http://localhost:4000/"), null);
  const site = await sample("http://localhost:5000/");
  assert.equal(site.domain, "school.example");
  assert.equal(site.url, undefined);
  tab = { ...tab, incognito: true };
  assert.equal(await sample("http://localhost:5000/"), null);
  tab = { ...tab, incognito: false };
  focused = false;
  assert.equal(await sample("http://localhost:5000/"), null);
});
