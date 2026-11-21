import { useState, type FormEvent } from "react";
import type { Task } from "../../types";

type Props = {
  tasks: Task[];
  onToggle: (taskId: string) => void;
  onAdd: (title: string) => void;
};

export default function TaskBoard({ tasks, onToggle, onAdd }: Props) {
  const [title, setTitle] = useState("");
  const remaining = tasks.filter((task) => !task.done).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    onAdd(cleanTitle);
    setTitle("");
  }

  return (
    <section className="content-card">
      <div className="section-heading"><div><p className="eyebrow">YOUR DAY</p><h2>Task list</h2></div><span className="count-chip">{remaining} left</span></div>
      <form className="add-task-form" onSubmit={submit}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Add a task…" aria-label="New task" />
        <button className="primary-button" type="submit">Add task +</button>
      </form>
      <ul className="task-list">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? "task-row done" : "task-row"}>
            <button className="check-button" aria-label={task.done ? "Mark incomplete" : "Complete task"} onClick={() => onToggle(task.id)}>{task.done ? "✓" : ""}</button>
            <span>{task.title}</span><span className="task-xp">+20 XP</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
