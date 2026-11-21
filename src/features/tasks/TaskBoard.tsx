import { useState, type FormEvent } from "react";
import type { Task } from "../../types";
import { TASK_XP } from "../pet/progression";

type TaskDraft = { title: string; description?: string; dueAt?: string };
type Props = {
  tasks: Task[];
  onToggle: (taskId: string) => void;
  onAdd: (task: TaskDraft) => void;
  onUpdate: (taskId: string, task: TaskDraft) => void;
};

function toLocalInput(isoDate: string | undefined): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export default function TaskBoard({ tasks, onToggle, onAdd, onUpdate }: Props) {
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const remaining = tasks.filter((task) => !task.done).length;

  function readDraft(form: HTMLFormElement): TaskDraft | null {
    const fields = new FormData(form);
    const title = String(fields.get("title") ?? "").trim();
    const description = String(fields.get("description") ?? "").trim();
    const dueInput = String(fields.get("dueAt") ?? "");
    if (!title) { setError("Enter a task name."); return null; }
    if (!dueInput) return { title, description: description || undefined };
    const due = new Date(dueInput);
    if (!Number.isFinite(due.getTime())) { setError("Enter a valid date and time, or leave it blank."); return null; }
    return { title, description: description || undefined, dueAt: due.toISOString() };
  }

  function submitNew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = readDraft(event.currentTarget);
    if (!draft) return;
    onAdd(draft);
    setError("");
    event.currentTarget.reset();
  }

  function submitEdit(event: FormEvent<HTMLFormElement>, taskId: string) {
    event.preventDefault();
    const draft = readDraft(event.currentTarget);
    if (!draft) return;
    onUpdate(taskId, draft);
    setError("");
    setEditingId(null);
  }

  function editForm(task: Task) {
    return <form className="edit-task-form" onSubmit={(event) => submitEdit(event, task.id)}>
      <label>Task name<input name="title" aria-label={`Edit title for ${task.title}`} defaultValue={task.title} maxLength={120} required /></label>
      <label>Description (optional)<textarea name="description" aria-label={`Edit description for ${task.title}`} rows={2} defaultValue={task.description ?? ""} maxLength={500} /></label>
      <label>Due date and time (optional)<input name="dueAt" type="datetime-local" aria-label={`Edit deadline for ${task.title}`} defaultValue={toLocalInput(task.dueAt)} /></label>
      <div className="inline-actions"><button className="primary-button" type="submit">Save task</button><button className="text-button" type="button" onClick={() => { setEditingId(null); setError(""); }}>Cancel</button></div>
    </form>;
  }

  return (
    <section className="content-card" aria-labelledby="task-list-title">
      <div className="section-heading"><h2 id="task-list-title">Task list</h2><span className="count-chip">{remaining} left</span></div>
      <form className="add-task-form" onSubmit={submitNew}>
        <label>Task name<input name="title" maxLength={120} required /></label>
        <label>Description (optional)<textarea name="description" rows={2} maxLength={500} /></label>
        <label>Due date and time (optional)<input name="dueAt" type="datetime-local" /></label>
        {error && !editingId && <p role="alert" className="task-form-error">{error}</p>}
        <button className="primary-button" type="submit">Add task</button>
      </form>
      {error && editingId && <p role="alert" className="task-form-error">{error}</p>}
      {tasks.length ? <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "task-row done" : "task-row"}>
            <button type="button" className="check-button" aria-label={`${task.done ? "Reopen" : "Complete"} ${task.title}`} aria-pressed={task.done} onClick={() => onToggle(task.id)}>{task.done ? "✓" : ""}</button>
            <div className="task-details">
              <span className="task-title">{task.title}</span>
              {task.description && <p>{task.description}</p>}
              {task.dueAt && <time dateTime={task.dueAt}>{new Date(task.dueAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>}
              {editingId === task.id && editForm(task)}
            </div>
            <span className="task-xp">{task.done || task.xpAwarded ? "XP earned" : `+${TASK_XP} XP`}</span>
            {editingId !== task.id && <button type="button" className="text-button task-edit-button" aria-label={`Edit ${task.title}`} onClick={() => { setEditingId(task.id); setError(""); }}>Edit</button>}
          </li>
        ))}
      </ul> : <p className="empty-state">No tasks yet. Add one small thing you want to get done.</p>}
    </section>
  );
}
