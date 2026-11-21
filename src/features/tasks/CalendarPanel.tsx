import { useState } from "react";
import type { Task } from "../../types";
import { activityDay } from "../activity/activity";
import { monthDays, scheduledTasks } from "./calendar";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPanel({ tasks, onViewTasks }: { tasks: readonly Task[]; onViewTasks: () => void }) {
  const [selected, setSelected] = useState(() => new Date());
  const { offset, days } = monthDays(selected);
  const scheduled = scheduledTasks(tasks);
  const selectedKey = activityDay(selected);
  const today = activityDay(new Date());
  const upcoming = scheduled.filter(({ day }) => day === selectedKey);

  function changeMonth(offset: number) {
    setSelected((date) => new Date(date.getFullYear(), date.getMonth() + offset, 1));
  }

  return <section className="content-card calendar-panel" aria-label="Task calendar">
    <div className="calendar-heading">
      <h2>{selected.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</h2>
      <div className="calendar-actions">
        <button className="friends-secondary" onClick={() => changeMonth(-1)} aria-label="Previous month">←</button>
        <button className="friends-secondary" onClick={() => setSelected(new Date())}>Today</button>
        <button className="friends-secondary" onClick={() => changeMonth(1)} aria-label="Next month">→</button>
      </div>
    </div>
    <div className="calendar-grid">
      {weekdays.map((day) => <span key={day} className="calendar-weekday">{day}</span>)}
      {Array.from({ length: offset }, (_, index) => <span key={`offset-${index}`} />)}
      {days.map((date) => {
        const day = activityDay(date);
        const count = scheduled.filter((entry) => entry.day === day).length;
        return <button type="button" key={day} aria-pressed={day === selectedKey} aria-current={day === today ? "date" : undefined}
          aria-label={`${date.toLocaleDateString(undefined, { dateStyle: "full" })}, ${count} ${count === 1 ? "task" : "tasks"}`} onClick={() => setSelected(date)}>
          {date.getDate()}{count > 0 && <small>{count}</small>}
        </button>;
      })}
    </div>
    <div className="calendar-agenda">
      <h3>{selected.toLocaleDateString(undefined, { dateStyle: "full" })}</h3>
      {upcoming.length ? <ul className="friends-list">{upcoming.map(({ task, date }) => <li key={task.id}>
        <span>{task.title}{task.done ? " · Done" : ""}</span>
        <time dateTime={date.toISOString()}>{date.toLocaleTimeString(undefined, { timeStyle: "short" })}</time>
      </li>)}</ul> : <p className="muted">No tasks scheduled for this day.</p>}
      <button className="text-button" onClick={onViewTasks}>Open task list</button>
    </div>
  </section>;
}
