import { useState, type FormEvent } from "react";
import type { Pet, PetAction } from "../../types";

type Props = {
  pet: Pet;
  onAction: (action: PetAction) => void;
  onRename: (name: string) => void;
  onCustomise: (change: Partial<Pick<Pet, "avatar" | "roomTheme">>) => void;
};

const avatars = ["🐣", "🐱", "🐸", "🦊", "🐼"];
const themes: { id: NonNullable<Pet["roomTheme"]>; label: string; emoji: string }[] = [
  { id: "lavender", label: "Lavender", emoji: "💜" },
  { id: "meadow", label: "Meadow", emoji: "🌿" },
  { id: "sunset", label: "Sunset", emoji: "🌅" },
];

function Meter({ label, value, icon }: { label: string; value: number; icon: string }) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div className="meter">
      <div className="meter-label"><span>{icon} {label}</span><strong>{safeValue}%</strong></div>
      <div className="meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={safeValue}>
        <span style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

function replyTo(message: string, name: string) {
  const text = message.toLowerCase();
  if (/\b(hello|hi|hey)\b/.test(text)) return `Hi there! I'm so glad you're here. What shall we do together?`;
  if (/\b(sad|bad|hard|stress|tired|worry)\b/.test(text)) return `That sounds like a lot. Let's take one small thing at a time. I'm right here with you. 💜`;
  if (/\b(task|study|work|homework|focus)\b/.test(text)) return `You've got this! A tiny first step counts. Finish a task and we'll earn 20 XP together.`;
  if (/\b(play|game|fun)\b/.test(text)) return `Play time! Use the Play button and I'll get a happiness boost (and 5 XP!).`;
  if (/\b(food|eat|hungry|snack)\b/.test(text)) return `A snack sounds lovely. Tap Feed and I'll feel much better! 🍓`;
  if (/\b(thanks|thank you)\b/.test(text)) return `Always, ${name}! You're doing great. ✨`;
  return `I like chatting with you! Tell me about your day, or we can take a break together. ✨`;
}

export default function PetRoom({ pet, onAction, onRename, onCustomise }: Props) {
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<{ from: "you" | "pet"; text: string }[]>([
    { from: "pet", text: `Hi! I'm ${pet.name}. I'm happy you're here. What would you like to do?` },
  ]);
  const levelXp = pet.xp % 100;
  const moodEmoji = pet.energy === 0 ? "😴" : pet.hunger > 70 ? "🥺" : pet.happiness < 30 ? "😿" : "🐣";
  const mood = pet.energy === 0 ? "A little sleepy" : pet.hunger > 70 ? "Ready for a snack" : pet.happiness < 30 ? "Could use some playtime" : "Feeling cosy and content";

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    setMessages((current) => [...current, { from: "you", text: message }, { from: "pet", text: replyTo(message, pet.name) }].slice(-9));
    setDraft("");
  }

  return (
    <section className={`pet-room content-card theme-${pet.roomTheme ?? "lavender"}`}>
      <div className="section-heading">
        <div><p className="eyebrow">YOUR LITTLE FRIEND</p><h2>Pet room</h2></div>
        <span className="count-chip">LEVEL {pet.level}</span>
      </div>

      <div className="pet-stage">
        <span className="stage-star star-one" aria-hidden="true">✦</span><span className="stage-star star-two" aria-hidden="true">✧</span>
        <div className="pet-large" aria-label={`${pet.name}, ${mood.toLowerCase()}`} role="img">{pet.avatar ?? moodEmoji}</div>
        <h3>{pet.name}</h3><p className="pet-mood">{mood}</p>
        <label className="rename-label">Pet name <input value={pet.name} maxLength={16} onChange={(event) => onRename(event.target.value)} onBlur={() => { if (!pet.name.trim()) onRename("Pixel"); }} /></label>
      </div>

      <div className="pet-controls">
        <Meter label="Fullness" value={100 - pet.hunger} icon="♡" />
        <Meter label="Happiness" value={pet.happiness} icon="☺" />
        <Meter label="Energy" value={pet.energy} icon="☼" />
      </div>
      <div className="action-row" aria-label="Pet care actions">
        <button onClick={() => onAction("feed")} disabled={pet.hunger <= 0} title={pet.hunger <= 0 ? "I'm full!" : "Give your pet a snack"}>🍓 Feed</button>
        <button onClick={() => onAction("play")} disabled={pet.energy <= 0} title={pet.energy <= 0 ? "Rest first to get some energy" : "Play together to boost happiness and earn 5 XP"}>🪀 Play <span className="action-reward">+5 XP</span></button>
        <button onClick={() => onAction("rest")} disabled={pet.energy >= 100} title={pet.energy >= 100 ? "Energy is full" : "Rest to restore energy"}>💤 Rest</button>
      </div>

      <section className="pet-xp" aria-label="Level progress">
        <div className="xp-heading"><span>✨ Level {pet.level}</span><strong>{levelXp} / 100 XP</strong></div>
        <div className="xp-track" role="meter" aria-label="XP progress to next level" aria-valuemin={0} aria-valuemax={100} aria-valuenow={levelXp}><span style={{ width: `${levelXp}%` }} /></div>
        <p className="xp-line">{100 - levelXp} XP to level {pet.level + 1} · Tasks give 20 XP; playing gives 5 XP.</p>
      </section>

      <section className="customise-panel" aria-labelledby="customise-title">
        <div className="subsection-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h3 id="customise-title">Customise your room</h3></div></div>
        <div className="customise-group"><span className="customise-label">Your companion</span><div className="choice-row">
          {avatars.map((avatar) => <button key={avatar} type="button" className={`avatar-choice${(pet.avatar ?? "🐣") === avatar ? " selected" : ""}`} aria-label={`Choose ${avatar} companion`} aria-pressed={(pet.avatar ?? "🐣") === avatar} onClick={() => onCustomise({ avatar })}>{avatar}</button>)}
        </div></div>
        <div className="customise-group"><span className="customise-label">Room mood</span><div className="choice-row theme-choices">
          {themes.map((theme) => <button key={theme.id} type="button" className={`theme-choice${(pet.roomTheme ?? "lavender") === theme.id ? " selected" : ""}`} aria-pressed={(pet.roomTheme ?? "lavender") === theme.id} onClick={() => onCustomise({ roomTheme: theme.id })}><span aria-hidden="true">{theme.emoji}</span>{theme.label}</button>)}
        </div></div>
      </section>

      <section className="pet-chat" aria-labelledby="chat-title">
        <div className="subsection-heading"><div><p className="eyebrow">A LITTLE CHAT</p><h3 id="chat-title">Talk to {pet.name}</h3></div><span className="chat-badge">SCRIPTED CHAT</span></div>
        <div className="chat-log" aria-live="polite" aria-relevant="additions">
          {messages.map((message, index) => <p key={`${index}-${message.from}`} className={`chat-message ${message.from}`}><span>{message.from === "pet" ? pet.name : "You"}</span>{message.text}</p>)}
        </div>
        <form className="chat-form" onSubmit={sendMessage}>
          <input aria-label={`Message ${pet.name}`} value={draft} maxLength={180} onChange={(event) => setDraft(event.target.value)} placeholder={`Say something to ${pet.name}…`} />
          <button type="submit" disabled={!draft.trim()}>Send <span aria-hidden="true">↗</span></button>
        </form>
        <p className="chat-note">Your companion uses a few friendly replies about your day and pet care.</p>
      </section>
    </section>
  );
}
