const form = document.querySelector("#pet-chat");
const input = document.querySelector("#message");
const send = form.querySelector("button");
const log = document.querySelector("#chat-log");
const typing = document.querySelector("#typing");
const speech = document.querySelector("#pet-speech");

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
  if (who === "pet") speech.textContent = text;
}

function replyBubble(text) {
  bubble(text, "pet");
  if (["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
    void fetch("/api/desktop-pet", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: Array.from(text).slice(0, 280).join("") }),
    }).catch(() => {});
  }
}

const savedPet = load("gencity-progress")?.pet ?? load("gencity-pet");
const petName = plannerContext().pet.name || "Wobbles";
const species = savedPet?.species ?? ({ "🐱": "cat", "🐶": "dog" }[savedPet?.avatar] ?? "camel");
document.querySelectorAll(".speaker-sprite img").forEach((frame, index) => {
  if (species === "custom" && /^data:image\/png;base64,/.test(savedPet?.customFrames?.[index] ?? "")) {
    frame.src = savedPet.customFrames[index];
  } else if (["camel", "cat", "dog"].includes(species)) {
    frame.src = new URL(`./${species}-${index + 1}.png`, frame.src);
  }
});
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
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error();
    const { reply } = await response.json();
    if (typeof reply !== "string" || !reply.trim()) throw new Error();
    replyBubble(reply);
  } catch {
    replyBubble("I'm right here with you. Let’s take one small step together. 💜");
  } finally {
    typing.textContent = "";
    send.disabled = false;
  }
});
