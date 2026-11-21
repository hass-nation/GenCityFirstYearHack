window.addEventListener("message", async (event) => {
  if (event.source !== window || event.origin !== location.origin || event.data?.type !== "pcpet:sample-site") return;
  try {
    const site = await chrome.runtime.sendMessage({ type: "sample-site" });
    window.postMessage({ type: "pcpet:site-sample", id: event.data.id, site }, location.origin);
  } catch {
    // The extension may have been reloaded while the planner was open.
  }
});
