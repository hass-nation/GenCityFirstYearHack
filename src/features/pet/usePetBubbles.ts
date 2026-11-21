import { useEffect, useRef, useState } from "react";
import { activityDay, getAppActivity, type ActivityState } from "../activity/activity";
import { identityKey, messagingRequest, type FriendMessage } from "../friends/messages";
import { speakOnDesktop } from "./desktopSync";

const uplifting = [
  "Tiny progress still counts. I’m cheering for you!",
  "A quick stretch sounds pretty good right now.",
  "If today feels busy, pick one small thing to do next.",
];

export function usePetBubbles(activity?: ActivityState) {
  const latest = useRef(activity);
  const [inbox, setInbox] = useState<FriendMessage[]>([]);
  const [bubble, setBubble] = useState("");
  useEffect(() => { latest.current = activity; }, [activity]);

  useEffect(() => {
    const controller = new AbortController();
    let bubbleTimer: number | undefined;
    let nudgeTimer: number | undefined;
    let token = "";
    let cursor = 0;
    let lastNotice = 0;

    function show(text: string) {
      window.clearTimeout(bubbleTimer);
      setBubble(text);
      speakOnDesktop(text);
      lastNotice = Date.now();
      bubbleTimer = window.setTimeout(() => setBubble(""), 12_000);
    }

    async function checkInbox() {
      const current = localStorage.getItem(identityKey) ?? "";
      if (current !== token) {
        token = current;
        cursor = 0;
        setInbox([]);
      }
      if (!token) return;
      const identity = token;
      try {
        const data = await messagingRequest<{ messages: FriendMessage[] }>(`/api/messages?after=${cursor}`, identity, undefined, controller.signal);
        if (controller.signal.aborted || token !== identity || !data.messages.length || data.messages.at(-1)!.id <= cursor) return;
        const unseen = data.messages.filter(({ id }) => id > cursor);
        const message = unseen.at(-1)!;
        cursor = message.id;
        setInbox((previous) => [...previous, ...unseen].slice(-100));
        const seenKey = `gencity-inbox-seen-${identity}`;
        if (cursor > Number(localStorage.getItem(seenKey))) {
          localStorage.setItem(seenKey, String(cursor));
          show(`${message.sender_name}: ${message.body}`);
        }
      } catch {
        // A static deployment or an offline server has no inbox.
      }
    }

    function nudge() {
      if (document.visibilityState === "visible" && Date.now() - lastNotice > 60_000) {
        const today = activityDay(new Date());
        const apps = getAppActivity(latest.current, today).filter((app) => !app.hidden && !app.website);
        const longUse = apps.find((app) => app.todayMs >= 60 * 60_000);
        const unused = apps.find((app) => app.totalMs > 0 && app.recentMs === 0);
        if (longUse) show(`You’ve spent at least an hour in ${longUse.name} today. Want to take a short break?`);
        else if (unused) show(`It’s been a week since you used ${unused.name}. Need it for anything coming up?`);
        else show(uplifting[Math.floor(Math.random() * uplifting.length)]);
      }
      nudgeTimer = window.setTimeout(nudge, 60_000 * (15 + Math.random() * 10));
    }

    void checkInbox();
    const poll = window.setInterval(() => void checkInbox(), 3000);
    nudgeTimer = window.setTimeout(nudge, 120_000 + Math.random() * 60_000);
    return () => {
      controller.abort();
      window.clearInterval(poll);
      window.clearTimeout(nudgeTimer);
      window.clearTimeout(bubbleTimer);
    };
  }, []);

  return { inbox, bubble };
}
