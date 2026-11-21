import { useEffect, useState } from "react";
import type { Task } from "../../types";
import { getReminderSections, type ReminderSection } from "./reminders";
import { getSmartReminder } from "./smart-reminders";

type Props = {
  tasks: readonly Task[];
  remindersEnabled: boolean;
  onToggle: (id: string) => void;
  onSnooze: (id: string, until: string) => void;
  onDismiss: (id: string) => void;
};

const sectionLabels: Record<ReminderSection, string> = { overdue: "Overdue", today: "Today", later: "Later" };

function snoozeUntil(duration: "hour" | "tomorrow", now: Date): string {
  const target = new Date(now);
  if (duration === "hour") target.setHours(target.getHours() + 1);
  else {
    target.setDate(target.getDate() + 1);
    target.setHours(9, 0, 0, 0);
  }
  return target.toISOString();
}

export default function RemindersPage({ tasks, remindersEnabled, onToggle, onSnooze, onDismiss }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const smartReminder = getSmartReminder(tasks, now);
  const sections = getReminderSections(tasks, now);
  const total = Object.values(sections).reduce((sum, items) => sum + items.length, 0);

  return (
    <section className="reminders-page" aria-labelledby="reminders-title">
      <div className="section-heading"><div><p className="eyebrow">A LITTLE NUDGE</p><h2 id="reminders-title">Reminders</h2><p className="muted">Keep an eye on what is due next.</p></div><span className="count-chip">{total} upcoming</span></div>
      {!remindersEnabled && <p className="inline-notice" role="status">Reminders are off. Turn them on in Settings to see the popup reminder.</p>}
      {smartReminder && <aside className="smart-reminder" aria-label="Smart reminder"><span className="eyebrow">SMART REMINDER</span><strong>{smartReminder}</strong><p>Based on your nearest active deadline.</p></aside>}
      {total === 0 ? <section className="content-card empty-state"><h3>Nothing due yet</h3><p>Add a task deadline and it will show here.</p></section> : (Object.keys(sectionLabels) as ReminderSection[]).map((section) => {
        const items = sections[section];
        if (!items.length) return null;
        return <section className="content-card reminder-section" key={section} aria-labelledby={`reminders-${section}`}>
          <div className="section-heading"><h3 id={`reminders-${section}`}>{sectionLabels[section]}</h3><span className="count-chip">{items.length}</span></div>
          <ul className="reminder-list">{items.map((item) => <li key={item.id} className="reminder-item">
            <div className="reminder-copy"><strong>{item.title}</strong><time dateTime={item.dueAt.toISOString()}>{item.dueAt.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>{item.task.description && <p>{item.task.description}</p>}{item.snoozedUntil && item.snoozedUntil > now && <span className="snooze-status">Snoozed until {item.snoozedUntil.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>}</div>
            <div className="reminder-controls"><button type="button" className="primary-button" onClick={() => onToggle(item.id)}>Mark done</button><button type="button" className="text-button" onClick={() => onSnooze(item.id, snoozeUntil("hour", now))}>Snooze 1h</button><button type="button" className="text-button" onClick={() => onSnooze(item.id, snoozeUntil("tomorrow", now))}>Tomorrow</button><button type="button" className="text-button" onClick={() => onDismiss(item.id)}>Dismiss</button></div>
          </li>)}</ul>
        </section>;
      })}
    </section>
  );
}
