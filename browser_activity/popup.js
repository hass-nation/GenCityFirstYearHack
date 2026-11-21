document.querySelector("#export").addEventListener("click", async () => {
  try {
    const tabs = (await chrome.tabs.query({})).filter((tab) => !tab.incognito);
    const windows = {};

    for (const tab of tabs) {
      const domain = tab.url ? new URL(tab.url).hostname : "";
      (windows[tab.windowId] ??= []).push({ title: tab.title ?? "", domain });
    }

    const file = new Blob([JSON.stringify({ windows }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = "pc-pet-tabs.json";
    link.click();
    document.querySelector("#status").textContent = `Exported ${tabs.length} tabs.`;
  } catch (error) {
    document.querySelector("#status").textContent = `Export failed. ${error.message}`;
  }
});
const status = document.querySelector("#status");

document.querySelector("#enable").addEventListener("click", async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url);
    if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || tab.incognito) {
      status.textContent = "Open the local PC Pet planner tab first.";
      return;
    }
    await chrome.storage.local.set({ plannerOrigin: url.origin });
    status.textContent = `Website tracking enabled for ${url.origin}.`;
  } catch {
    status.textContent = "Could not enable website tracking. Open the local planner and try again.";
  }
});

document.querySelector("#disable").addEventListener("click", async () => {
  try {
    await chrome.storage.local.remove("plannerOrigin");
    status.textContent = "Website tracking is off.";
  } catch {
    status.textContent = "Could not change the website tracking setting.";
  }
});
