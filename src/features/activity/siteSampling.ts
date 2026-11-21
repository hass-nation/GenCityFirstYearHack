import type { ActivityCapture } from "./activity.ts";

export type SiteSample = { browser: "chrome" | "msedge"; domain: string; tabId: number; revision: number };

export function sampleSite(): Promise<SiteSample | null> {
  const id = crypto.randomUUID();
  return new Promise((resolve) => {
    function finish(site: SiteSample | null) {
      window.clearTimeout(timer);
      window.removeEventListener("message", receive);
      resolve(site);
    }
    function receive(event: MessageEvent) {
      if (event.source === window && event.origin === location.origin && event.data?.type === "pcpet:site-sample" && event.data.id === id) {
        finish(event.data.site ?? null);
      }
    }
    const timer = window.setTimeout(() => finish(null), 250);
    window.addEventListener("message", receive);
    window.postMessage({ type: "pcpet:sample-site", id }, location.origin);
  });
}

export function attributeWebsite(capture: ActivityCapture, first: SiteSample | null, last: SiteSample | null): ActivityCapture {
  if (!first || !last || first.domain !== last.domain || first.tabId !== last.tabId || first.browser !== last.browser || first.revision !== last.revision) return capture;
  if (!/^[a-z0-9.-]{1,253}$/i.test(first.domain) || !["chrome", "msedge"].includes(first.browser)) return capture;
  const app = capture.apps.find(({ name }) => name === first.browser);
  if (!app) return capture;
  return { ...capture, websites: [{ name: first.domain.toLowerCase(), sessions: app.sessions }] };
}
