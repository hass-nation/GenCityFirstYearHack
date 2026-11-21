import { useEffect, useRef } from "react";

export const friendsTokenKey = "gencity-friends-token";
export const sharingKey = "gencity-screen-time-sharing";
export type ScreenTime = { day: string; seconds: number };

export function useScreenTimeSharing(screenTime: ScreenTime) {
  const latest = useRef(screenTime);
  useEffect(() => { latest.current = screenTime; }, [screenTime]);
  useEffect(() => {
    let previous = "";
    let pending = false;
    const controller = new AbortController();
    async function publish() {
      const token = localStorage.getItem(friendsTokenKey);
      if (!token || localStorage.getItem(sharingKey) !== "true") {
        previous = "";
        return;
      }
      const body = JSON.stringify(latest.current);
      const fingerprint = token + body;
      if (pending || fingerprint === previous) return;
      pending = true;
      try {
        const response = await fetch("/api/me/screen-time", {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (response.ok) previous = fingerprint;
      } catch {
        // Retry after the next interval while the user is sharing.
      } finally {
        pending = false;
      }
    }
    void publish();
    const timer = window.setInterval(() => void publish(), 15_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, []);
}
