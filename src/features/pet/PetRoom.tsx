import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Pet } from "../../types";
import PetSprite from "./PetSprite";
import { builtInPets, DEFAULT_PET_NAME, petSpecies, readSpriteFrame, type AppearanceChange } from "./appearance";
import { speakOnDesktop } from "./desktopSync";
import { XP_PER_LEVEL } from "./progression";

type Props = {
  pet: Pet;
  onRename: (name: string) => void;
  onCustomise: (change: AppearanceChange) => void;
};

type ChatMessage = { from: "you" | "pet"; text: string };

function replyTo(message: string, name: string) {
  const text = message.toLowerCase();
  if (/\b(hello|hi|hey)\b/.test(text)) return `Hi there! I'm so glad you're here. What shall we do together?`;
  if (/\b(sad|bad|hard|stress|tired|worry)\b/.test(text)) return `That sounds like a lot. Let's take one small thing at a time. I'm right here with you. 💜`;
  if (/\b(task|study|work|homework|focus)\b/.test(text)) return `You've got this! A tiny first step counts. Finish a task and we’ll earn XP together.`;
  if (/\b(thanks|thank you)\b/.test(text)) return `Always, ${name}! You're doing great. ✨`;
  return `I like chatting with you! Tell me about your day, or we can take a break together. ✨`;
}

export default function PetRoom({ pet, onRename, onCustomise }: Props) {
  const [sending, setSending] = useState(false);
  const [chatStatus, setChatStatus] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "pet", text: `Hi! I'm ${pet.name}. I'm happy you're here. What would you like to do?` },
  ]);
  const [speech, setSpeech] = useState(`Hi! I’m ${pet.name}.`);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const chatLog = useRef<HTMLDivElement>(null);
  const species = petSpecies(pet);
  const levelXp = pet.xp % XP_PER_LEVEL;

  useEffect(() => {
    const log = chatLog.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || sending) return;
    setDraft("");
    setSending(true);
    let reply = replyTo(message, pet.name);
    let status = "Local reply · Chat server unavailable";
    try {
      const response = await fetch("/pet/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }), signal: AbortSignal.timeout(30000),
      });
      if (response.ok) {
        const data = await response.json();
        if (typeof data.reply === "string" && data.reply.trim()) reply = data.reply;
        if (data.source === "agent") status = "Snowflake Cortex";
        else if (data.fallback_reason === "not_configured") status = "Local reply · Snowflake is not configured";
        else status = "Local reply · Snowflake couldn’t respond";
      }
    } catch {
      // The static demo and offline sessions use the local reply.
    } finally {
      addMessage(message, reply);
      setChatStatus(status);
      setSending(false);
    }
  }

  function addMessage(message: string, reply: string) {
    setMessages((current) => {
      const next: ChatMessage[] = [...current, { from: "you", text: message }, { from: "pet", text: reply }];
      return next.slice(-9);
    });
    say(reply);
  }

  function say(text: string) {
    setSpeech(text);
    speakOnDesktop(text);
  }

  async function uploadSprite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const first = fields.get("frame-one");
    const second = fields.get("frame-two");
    if (!(first instanceof File) || !(second instanceof File) || !first.size || !second.size) {
      setUploadError("Choose an image for each frame.");
      return;
    }
    setUploadError("");
    setUploading(true);
    try {
      const [frameOne, frameTwo] = await Promise.all([readSpriteFrame(first), readSpriteFrame(second)]);
      onCustomise({ species: "custom", customFrames: [frameOne, frameTwo] });
      form.reset();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not read the sprite images.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <section className={`pet-room content-card theme-${pet.roomTheme ?? "lavender"}`}>
      <div className="section-heading">
        <h2>Companion care</h2>
        <span className="count-chip">LEVEL {pet.level}</span>
      </div>

      <div className="pet-stage">
        <div className="pet-speech" role="status">{speech}</div>
        <PetSprite className="pet-large" species={species} customFrames={pet.customFrames} />
        <h3>{pet.name}</h3>
        <label className="rename-label">Pet name <input value={pet.name} maxLength={16} onChange={(event) => onRename(event.target.value)} onBlur={() => { if (!pet.name.trim()) onRename(DEFAULT_PET_NAME); }} /></label>
      </div>

      <section className="pet-xp" aria-label="Level progress">
        <div className="xp-heading"><span>✨ Level {pet.level}</span><strong>{levelXp} / {XP_PER_LEVEL} XP</strong></div>
        <div className="xp-track" role="meter" aria-label="XP progress to next level" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={levelXp}><span style={{ width: `${levelXp / XP_PER_LEVEL * 100}%` }} /></div>
        <p className="xp-line">{XP_PER_LEVEL - levelXp} XP to level {pet.level + 1}</p>
      </section>

      <section className="customise-panel" aria-labelledby="customise-title">
        <div className="subsection-heading"><h3 id="customise-title">Customise your room</h3></div>
        <div className="customise-group"><span className="customise-label">Your companion</span><div className="choice-row">
          {builtInPets.map(({ id, label }) => <button key={id} type="button" className="avatar-choice" aria-pressed={species === id} disabled={uploading} onClick={() => onCustomise({ species: id })}><PetSprite species={id} still />{label}</button>)}
          {pet.customFrames && <button type="button" className="avatar-choice" aria-pressed={species === "custom"} disabled={uploading} onClick={() => onCustomise({ species: "custom" })}><PetSprite species="custom" customFrames={pet.customFrames} still />Custom</button>}
        </div></div>
        <details className="sprite-upload">
          <summary>Upload a custom sprite</summary>
          <form onSubmit={uploadSprite}>
            <p>Choose two images in the order they should play. Transparent PNGs work best.</p>
            <fieldset disabled={uploading}>
              <label>Frame 1 <input type="file" name="frame-one" accept="image/png,image/jpeg,image/webp" required /></label>
              <label>Frame 2 <input type="file" name="frame-two" accept="image/png,image/jpeg,image/webp" required /></label>
            </fieldset>
            {uploadError && <p role="alert" className="task-form-error">{uploadError}</p>}
            <button type="submit" className="primary-button" disabled={uploading}>{uploading ? "Preparing sprite…" : "Use custom sprite"}</button>
          </form>
        </details>
      </section>

      <section className="pet-chat" aria-labelledby="chat-title">
        <div className="subsection-heading"><h3 id="chat-title">Talk to {pet.name}</h3>{chatStatus && <span className="chat-badge">{chatStatus}</span>}</div>
        <div className="chat-log" ref={chatLog} aria-label="Chat history">
          {messages.map((message, index) => <div key={`${index}-${message.from}`} className={`chat-turn ${message.from}`}>
            {message.from === "pet" && <PetSprite className="chat-sprite" species={species} customFrames={pet.customFrames} still />}
            <p className={`chat-message ${message.from}`}><span className="chat-speaker">{message.from === "pet" ? pet.name : "You"}</span>{message.text}</p>
          </div>)}
        </div>
        <form className="chat-form" onSubmit={sendMessage}>
          <input aria-label={`Message ${pet.name}`} value={draft} maxLength={180} onChange={(event) => setDraft(event.target.value)} placeholder={`Say something to ${pet.name}…`} />
          <button type="submit" disabled={sending || !draft.trim()}>{sending ? "Thinking…" : "Send"} <span aria-hidden="true">↗</span></button>
        </form>
      </section>
    </section>
  );
}
