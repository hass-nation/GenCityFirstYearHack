import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Page, Pet, PetAction } from "../../types";
import VoiceControls from "./VoiceControls";
import PetSprite from "./PetSprite";
import { builtInPets, DEFAULT_PET_NAME, petSpecies, readSpriteFrame, type AppearanceChange } from "./appearance";
import { speakOnDesktop } from "./desktopSync";
import { PLAY_ENERGY, PLAY_XP, TASK_XP, XP_PER_LEVEL } from "./progression";

type Props = {
  pet: Pet;
  onAction: (action: PetAction) => void;
  onRename: (name: string) => void;
  onCustomise: (change: AppearanceChange) => void;
  onNavigate: (page: Page) => void;
};

type ChatMessage = { from: "you" | "pet"; text: string };

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
  if (/\b(task|study|work|homework|focus)\b/.test(text)) return `You've got this! A tiny first step counts. Finish a task and we'll earn ${TASK_XP} XP together.`;
  if (/\b(play|game|fun)\b/.test(text)) return `Play time! Use the Play button and I'll get a happiness boost (and ${PLAY_XP} XP!).`;
  if (/\b(food|eat|hungry|snack)\b/.test(text)) return `A snack sounds lovely. Tap Feed and I'll feel much better! 🍓`;
  if (/\b(thanks|thank you)\b/.test(text)) return `Always, ${name}! You're doing great. ✨`;
  return `I like chatting with you! Tell me about your day, or we can take a break together. ✨`;
}

export default function PetRoom({ pet, onAction, onRename, onCustomise, onNavigate }: Props) {
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
  const canPlay = pet.energy >= PLAY_ENERGY;
  const mood = pet.energy === 0 ? "A little sleepy" : pet.hunger > 70 ? "Ready for a snack" : pet.happiness < 30 ? "Could use some playtime" : "Feeling cosy and content";

  useEffect(() => {
    const log = chatLog.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages]);

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message) return;
    addMessage(message);
    setDraft("");
  }

  function addMessage(message: string) {
    const reply = replyTo(message, pet.name);
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

  function care(action: PetAction) {
    onAction(action);
    say({ feed: "That hit the spot. Thank you!", play: "That was fun! Let’s do it again later.", rest: "I feel more rested already." }[action]);
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

  function voiceCommand(transcript: string) {
    const command = transcript.toLowerCase().replace(/[.!?]+$/, "");
    if (/^(feed( (the |my )?pet)?|give (the |my )?pet a snack)$/.test(command)) {
      if (pet.hunger <= 0) return `${pet.name} is already full.`;
      care("feed");
      return `Fed ${pet.name}.`;
    }
    if (/^play( with (the |my )?pet)?$/.test(command)) {
      if (!canPlay) return `${pet.name} needs to rest before playing.`;
      care("play");
      return `Played with ${pet.name}.`;
    }
    if (/^(rest|rest (the |my )?pet|take a nap)$/.test(command)) {
      if (pet.energy >= 100) return `${pet.name} is already rested.`;
      care("rest");
      return `${pet.name} had a rest.`;
    }
    const page = /^open (home|tasks|calendar|activity|friends)$/.exec(command)?.[1] as Page | undefined;
    if (page) {
      onNavigate(page);
      return `Opened ${page}.`;
    }
    addMessage(transcript.slice(0, 180));
    return `Sent your message to ${pet.name}.`;
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
        <h3>{pet.name}</h3><p className="pet-mood">{mood}</p>
        <label className="rename-label">Pet name <input value={pet.name} maxLength={16} onChange={(event) => onRename(event.target.value)} onBlur={() => { if (!pet.name.trim()) onRename(DEFAULT_PET_NAME); }} /></label>
      </div>

      <div className="pet-controls">
        <Meter label="Fullness" value={100 - pet.hunger} icon="♡" />
        <Meter label="Happiness" value={pet.happiness} icon="☺" />
        <Meter label="Energy" value={pet.energy} icon="☼" />
      </div>
      <div className="action-row" aria-label="Pet care actions">
        <button onClick={() => care("feed")} disabled={pet.hunger <= 0} title={pet.hunger <= 0 ? "I'm full!" : "Give your pet a snack"}>Feed</button>
        <button onClick={() => care("play")} disabled={!canPlay} title={canPlay ? `Play costs ${PLAY_ENERGY}% energy` : `Rest first. Play needs ${PLAY_ENERGY}% energy.`}>Play <span className="action-reward">+{PLAY_XP} XP</span></button>
        <button onClick={() => care("rest")} disabled={pet.energy >= 100} title={pet.energy >= 100 ? "Energy is full" : "Rest to restore energy"}>Rest</button>
      </div>

      <section className="pet-xp" aria-label="Level progress">
        <div className="xp-heading"><span>✨ Level {pet.level}</span><strong>{levelXp} / {XP_PER_LEVEL} XP</strong></div>
        <div className="xp-track" role="meter" aria-label="XP progress to next level" aria-valuemin={0} aria-valuemax={XP_PER_LEVEL} aria-valuenow={levelXp}><span style={{ width: `${levelXp / XP_PER_LEVEL * 100}%` }} /></div>
        <p className="xp-line">{XP_PER_LEVEL - levelXp} XP to level {pet.level + 1} · {TASK_XP} XP per new task completion · {PLAY_XP} XP per play</p>
        {!canPlay && <p className="xp-line">Rest to restore enough energy to play.</p>}
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
        <div className="customise-group"><span className="customise-label">Room mood</span><div className="choice-row theme-choices">
          {themes.map((theme) => <button key={theme.id} type="button" className={`theme-choice${(pet.roomTheme ?? "lavender") === theme.id ? " selected" : ""}`} aria-pressed={(pet.roomTheme ?? "lavender") === theme.id} onClick={() => onCustomise({ roomTheme: theme.id })}><span aria-hidden="true">{theme.emoji}</span>{theme.label}</button>)}
        </div></div>
      </section>

      <section className="pet-chat" aria-labelledby="chat-title">
        <div className="subsection-heading"><h3 id="chat-title">Talk to {pet.name}</h3><span className="chat-badge">Scripted chat</span></div>
        <div className="chat-log" ref={chatLog} aria-label="Chat history">
          {messages.map((message, index) => <div key={`${index}-${message.from}`} className={`chat-turn ${message.from}`}>
            {message.from === "pet" && <PetSprite className="chat-sprite" species={species} customFrames={pet.customFrames} still />}
            <p className={`chat-message ${message.from}`}><span className="chat-speaker">{message.from === "pet" ? pet.name : "You"}</span>{message.text}</p>
          </div>)}
        </div>
        <form className="chat-form" onSubmit={sendMessage}>
          <input aria-label={`Message ${pet.name}`} value={draft} maxLength={180} onChange={(event) => setDraft(event.target.value)} placeholder={`Say something to ${pet.name}…`} />
          <button type="submit" disabled={!draft.trim()}>Send <span aria-hidden="true">↗</span></button>
        </form>
        <VoiceControls onCommand={voiceCommand} />
        <p className="chat-note">Your companion uses a few friendly replies about your day and pet care.</p>
      </section>
    </section>
  );
}
