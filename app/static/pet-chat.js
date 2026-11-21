const form = document.querySelector("#pet-chat");
const input = document.querySelector("#message");
const send = form.querySelector("button");
const log = document.querySelector("#chat-log");
const typing = document.querySelector("#typing");

function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function studyStreak(tasks) {
  const now = new Date();
  const days = new Set(tasks.flatMap((task) => {
    const completed = new Date(task?.completedAt ?? "");
    return task?.done && completed <= now ? [completed.toDateString()] : [];
  }));
  if (!days.size) return undefined;
  if (!days.has(now.toDateString())) now.setDate(now.getDate() - 1);
  let streak = 0;
  while (days.has(now.toDateString())) {
    streak++;
    now.setDate(now.getDate() - 1);
  }
  return streak;
}

function plannerContext() {
  const state = load("gencity-progress");
  const pet = state?.pet ?? load("gencity-pet") ?? {};
  const savedTasks = state?.tasks ?? load("gencity-tasks");
  const tasks = Array.isArray(savedTasks) ? savedTasks : [];
  const unfinished = tasks.filter((task) => task && !task.done);
  const dated = unfinished.filter((task) => Number.isFinite(Date.parse(task.dueAt)));
  dated.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
  const next = dated[0] ?? unfinished[0];
  const mood = pet.energy === 0 ? "sleepy" : pet.hunger > 70 ? "hungry" : pet.happiness < 30 ? "low" : "content";
  return {
    pet: { name: typeof pet.name === "string" ? pet.name.slice(0, 32) : undefined, mood: pet.name ? mood : undefined, level: pet.level, xp: pet.xp },
    next_task: next ? { title: typeof next.title === "string" ? next.title.slice(0, 120) : undefined, dueAt: next.dueAt } : null,
    streak: studyStreak(tasks),
  };
}

function bubble(text, who) {
  const message = document.createElement("p");
  message.className = `bubble ${who}`;
  message.textContent = text;
  log.append(message);
  log.scrollTop = log.scrollHeight;
}

const petName = plannerContext().pet.name || "Biscuit";
document.querySelector("#pet-name").textContent = petName;
bubble(`Hi! I’m ${petName}. What would you like to talk about?`, "pet");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || send.disabled) return;
  bubble(message, "you");
  input.value = "";
  send.disabled = true;
  typing.textContent = `${petName} is typing…`;
  try {
    const response = await fetch(form.action, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context: plannerContext() }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error();
    const { reply } = await response.json();
    if (typeof reply !== "string" || !reply.trim()) throw new Error();
    bubble(reply, "pet");
  } catch {
    bubble("I'm right here with you. Let’s take one small step together. 💜", "pet");
  } finally {
    typing.textContent = "";
    send.disabled = false;
  }
});
