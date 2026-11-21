import { useEffect, useState } from "react";
import type { ActivityCapture } from "./activity";
import { attributeWebsite, sampleSite } from "./siteSampling";

export function useActivityCapture(onCapture: (capture: ActivityCapture) => void) {
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  const [status, setStatus] = useState<"off" | "loading" | "tracking" | "offline">(local ? "loading" : "off");

  useEffect(() => {
    if (!local) return;
    const controller = new AbortController();
    let retry: number | undefined;
    async function capture() {
      try {
        while (!controller.signal.aborted) {
          const before = sampleSite();
          const response = await fetch("/api/activity/capture", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
          });
          if (!response.ok) throw new Error("Capture unavailable");
          const data: ActivityCapture = await response.json();
          if (!Array.isArray(data.apps)) throw new Error("Invalid capture");
          const first = await before;
          const last = first ? await sampleSite() : null;
          if (controller.signal.aborted) return;
          onCapture(attributeWebsite(data, first, last));
          setStatus("tracking");
          retry = window.setTimeout(() => void capture(), 250);
          return;
        }
      } catch {
        if (controller.signal.aborted) return;
        setStatus("offline");
        retry = window.setTimeout(() => void capture(), 2500);
      }
    }
    void capture();
    return () => {
      controller.abort();
      window.clearTimeout(retry);
    };
  }, [local, onCapture]);

  return { status };
}
