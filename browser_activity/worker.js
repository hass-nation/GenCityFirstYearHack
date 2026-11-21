let revision = 0;
chrome.tabs.onActivated.addListener(() => { revision++; });
chrome.tabs.onUpdated.addListener((_id, change) => { if (change.url) revision++; });
chrome.windows.onFocusChanged.addListener(() => { revision++; });

async function currentSite() {
  const before = revision;
  const browser = navigator.userAgent.includes("Edg/") ? "msedge" : "chrome";
  const window = await chrome.windows.getLastFocused({ windowTypes: ["normal"] });
  if (!window.focused || window.incognito) return null;
  const [tab] = await chrome.tabs.query({ active: true, windowId: window.id });
  if (!tab?.url || tab.incognito) return null;
  const { protocol, hostname } = new URL(tab.url);
  if (!['http:', 'https:'].includes(protocol) || ['localhost', '127.0.0.1', '[::1]'].includes(hostname)) return null;
  return before === revision ? { browser, domain: hostname, tabId: tab.id, revision } : null;
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== "sample-site" || !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(sender.url ?? "")) return;
  chrome.storage.local.get("plannerOrigin").then(({ plannerOrigin }) => (
    plannerOrigin === new URL(sender.url).origin ? currentSite() : null
  )).then(reply, () => reply(null));
  return true;
});
