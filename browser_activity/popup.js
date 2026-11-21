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
