import { useEffect, useState } from "react";
import type { Pet, PlannerSettings, Task } from "../../types";
import { getNextTaskReminder, isQuietHours } from "./reminders";

type Props = {
  tasks: readonly Task[];
  pet: Pet;
  settings: PlannerSettings;
  onDismiss: (id: string) => void;
  onSnooze: (id: string, until: string) => void;
  onViewTasks: () => void;
};

export default function TaskReminder({ tasks, pet, settings, onDismiss, onSnooze, onViewTasks }: Props) {
  const [now, setNow] = useState(Date.now);

  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  const date = new Date(now);
  const quiet = isQuietHours(date, settings.quietHoursEnabled, settings.quietHoursStart, settings.quietHoursEnd);
  const task = settings.remindersEnabled && !quiet ? getNextTaskReminder(tasks, now) : undefined;

  function snoozeForHour() {
    if (!task) return;
    onSnooze(task.id, new Date(now + 60 * 60 * 1000).toISOString());
  }

  function snoozeUntilTomorrow() {
    if (!task) return;
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0);
    onSnooze(task.id, tomorrow.toISOString());
  }
  return (
    <div className={task ? "pet-task-reminder" : undefined}>
      <div role="status">
        {task && <>
          <span className="reminder-avatar" aria-hidden="true">{pet.avatar ?? "🐶"}</span>
          <strong>{pet.name} says it’s time for {task.title}.</strong>
          {task.description && <p>{task.description}</p>}
        </>}
      </div>
      {task && <div className="reminder-actions">
        <button className="primary-button" onClick={onViewTasks}>View tasks</button>
        <button className="text-button" onClick={snoozeForHour}>Snooze 1h</button>
        <button className="text-button" onClick={snoozeUntilTomorrow}>Tomorrow</button>
        <button className="text-button" onClick={() => onDismiss(task.id)}>Dismiss</button>
      </div>}
    </div>
  );
}
