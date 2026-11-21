import { useEffect, useState } from "react";

type TabWindow = { windowId: number; tabs: string[] };
type Snapshot = { windows: Record<string, TabWindow[]>; unavailable?: boolean };

export function useOpenTabs(enabled: boolean) {
  const [snapshot, setSnapshot] = useState<Snapshot>();

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: number | undefined;

    async function refresh() {
      try {
        const response = await fetch("/api/activity/tabs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
        });
        if (!response.ok) throw new Error();
        const data: Snapshot = await response.json();
        if (!controller.signal.aborted) setSnapshot(data);
      } catch {
        if (!controller.signal.aborted) setSnapshot({ windows: {}, unavailable: true });
      } finally {
        if (!controller.signal.aborted) timer = window.setTimeout(() => void refresh(), 15_000);
      }
    }

    timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [enabled]);

  return enabled ? snapshot : undefined;
}
