import { useState, type FormEvent } from "react";
import type { Task } from "../../types";

type Props = {
  tasks: Task[];
  onToggle: (taskId: string) => void;
  onAdd: (task: { title: string; description?: string; dueAt: string }) => void;
};

export default function TaskBoard({ tasks, onToggle, onAdd }: Props) {
  const [error, setError] = useState("");
  const remaining = tasks.filter((task) => !task.done).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const title = String(fields.get("title") ?? "").trim();
    const description = String(fields.get("description") ?? "").trim();
    const due = new Date(`${fields.get("date")}T${fields.get("time")}`);
    if (!title || !Number.isFinite(due.getTime())) {
      setError("Enter a task name and a valid reminder date and time.");
      return;
    }
    onAdd({ title, description: description || undefined, dueAt: due.toISOString() });
    setError("");
    form.reset();
  }

  return (
    <section className="content-card">
      <div className="section-heading"><h2>Task list</h2><span className="count-chip">{remaining} left</span></div>
      <form className="add-task-form" onSubmit={submit}>
        <label>Task name<input name="title" maxLength={120} required /></label>
        <label>Description (optional)<textarea name="description" rows={2} maxLength={500} /></label>
        <div className="task-schedule">
          <label>Reminder date<input name="date" type="date" required /></label>
          <label>Reminder time<input name="time" type="time" required /></label>
        </div>
        {error && <p role="alert" className="task-form-error">{error}</p>}
        <button className="primary-button" type="submit">Add task</button>
      </form>
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "task-row done" : "task-row"}>
            <button className="check-button" aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`} onClick={() => onToggle(task.id)}>{task.done ? "✓" : ""}</button>
            <div className="task-details">
              <span className="task-title">{task.title}</span>
              {task.description && <p>{task.description}</p>}
              {task.dueAt && <time dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>}
            </div>
            <span className="task-xp">+20 XP</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
