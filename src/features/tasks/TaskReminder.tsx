import { useEffect, useState } from "react";
import type { Pet, Task } from "../../types";
import PetSprite from "../pet/PetSprite";
import { speakOnDesktop } from "../pet/desktopSync";
import { getNextTaskReminder } from "./reminders";

type Props = {
  tasks: readonly Task[];
  pet: Pet;
  onDismiss: (id: string) => void;
  onViewTasks: () => void;
};

export default function TaskReminder({ tasks, pet, onDismiss, onViewTasks }: Props) {
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

  const task = getNextTaskReminder(tasks, now);
  const reminder = task ? `It’s time for ${task.title}.` : "";
  useEffect(() => {
    if (reminder) speakOnDesktop(reminder);
  }, [reminder, task?.id]);

  return (
    <div className={task ? "pet-task-reminder" : undefined}>
      <div role="status">
        {task && <>
          <PetSprite className="reminder-avatar" species={pet.species} customFrames={pet.customFrames} />
          <strong>{pet.name} says it’s time for {task.title}.</strong>
          {task.description && <p>{task.description}</p>}
        </>}
      </div>
      {task && <div className="reminder-actions">
        <button className="primary-button" onClick={() => { onDismiss(task.id); onViewTasks(); }}>View tasks</button>
        <button className="text-button" onClick={() => onDismiss(task.id)}>Dismiss</button>
      </div>}
    </div>
  );
}
