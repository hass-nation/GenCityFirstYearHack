import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityCapture } from "./activity";

const preferenceKey = "gencity-activity-enabled";

function isTrackingEnabled() {
  try {
    return localStorage.getItem(preferenceKey) !== "false";
  } catch {
    return true;
  }
}

function rememberTracking(enabled: boolean) {
  try {
    localStorage.setItem(preferenceKey, String(enabled));
  } catch {
    // Tracking can still be toggled for this visit if browser storage is unavailable.
  }
}

export function useActivityCapture(onCapture: (capture: ActivityCapture) => void) {
  const [status, setStatus] = useState<"idle" | "tracking" | "stopping">("idle");
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const stopRequested = useRef(false);

  const start = useCallback(async () => {
    if (active.current) return;
    rememberTracking(true);
    const controller = new AbortController();
    active.current = controller;
    stopRequested.current = false;
    setError("");
    setStatus("tracking");

    try {
      let retriedBusy = false;
      while (!controller.signal.aborted && !stopRequested.current) {
        const response = await fetch("/api/activity/capture", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]),
        });
        const data = await response.json();
        if (response.status === 409 && !retriedBusy) {
          // A browser reload can leave the previous page's sample finishing on Flask.
          retriedBusy = true;
          await new Promise((resolve) => window.setTimeout(resolve, 2100));
          continue;
        }
        if (!response.ok) throw new Error(data.error || "Could not start foreground tracking.");
        if (!Array.isArray(data.apps)) throw new Error("The tracker returned an invalid capture.");
        if (controller.signal.aborted) break;
        onCapture(data);
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        setError(failure instanceof Error && failure.name === "Error" ? failure.message : "Could not reach the tracker. Start Flask locally and try again.");
      }
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setStatus("idle");
    }
  }, [onCapture]);

  useEffect(() => {
    const timer = isTrackingEnabled() ? window.setTimeout(() => void start(), 0) : undefined;
    return () => {
      window.clearTimeout(timer);
      active.current?.abort();
    };
  }, [start]);

  function stop() {
    rememberTracking(false);
    stopRequested.current = true;
    setStatus("stopping");
  }

  return { status, error, start, stop };
}
