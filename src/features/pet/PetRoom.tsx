import type { Pet } from "../../types";

type Props = {
  pet: Pet;
  onRename: (name: string) => void;
  onCustomise: (change: Partial<Pick<Pet, "avatar" | "roomTheme">>) => void;
};

const companions = [
  { avatar: "🐶", name: "Dog" },
  { avatar: "🐱", name: "Cat" },
  { avatar: "🐸", name: "Frog" },
  { avatar: "🦊", name: "Fox" },
  { avatar: "🐼", name: "Panda" },
];

const themes: { id: NonNullable<Pet["roomTheme"]>; label: string; emoji: string }[] = [
  { id: "lavender", label: "Lavender", emoji: "💜" },
  { id: "meadow", label: "Meadow", emoji: "🌿" },
  { id: "sunset", label: "Sunset", emoji: "🌅" },
];

export default function PetRoom({ pet, onRename, onCustomise }: Props) {
  return (
    <section className={`pet-room customise-page theme-${pet.roomTheme ?? "lavender"}`}>
      <div className="section-heading">
        <div>
          <p className="eyebrow">MAKE IT YOURS</p>
          <h2>Customise your companion</h2>
          <p className="muted">Pick a name, a look, and a room mood.</p>
        </div>
        <span className="count-chip">LEVEL {pet.level}</span>
      </div>

      <div className="pet-stage customise-preview">
        <div className="pet-large" aria-label={`${pet.name}, your companion`} role="img">{pet.avatar ?? "🐶"}</div>
        <h3>{pet.name || "Your companion"}</h3>
        <label className="rename-label">
          Pet name
          <input
            aria-label="Pet name"
            value={pet.name}
            maxLength={16}
            onChange={(event) => onRename(event.target.value)}
            onBlur={() => { if (!pet.name.trim()) onRename("Pixel"); }}
          />
        </label>
      </div>

      <section className="customise-panel" aria-labelledby="customise-title">
        <div className="subsection-heading">
          <div><p className="eyebrow">YOUR COMPANION</p><h3 id="customise-title">Choose an animal</h3></div>
        </div>
        <div className="choice-row" role="group" aria-label="Choose a companion">
          {companions.map(({ avatar, name }) => (
            <button
              key={avatar}
              type="button"
              className={`avatar-choice${(pet.avatar ?? "🐶") === avatar ? " selected" : ""}`}
              aria-label={`Choose ${name}`}
              aria-pressed={(pet.avatar ?? "🐶") === avatar}
              onClick={() => onCustomise({ avatar })}
            >{avatar}</button>
          ))}
        </div>
      </section>

      <section className="customise-panel" aria-labelledby="room-title">
        <div className="subsection-heading">
          <div><p className="eyebrow">ROOM MOOD</p><h3 id="room-title">Choose a theme</h3></div>
        </div>
        <div className="choice-row theme-choices" role="group" aria-label="Choose a room theme">
          {themes.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-choice${(pet.roomTheme ?? "lavender") === theme.id ? " selected" : ""}`}
              aria-pressed={(pet.roomTheme ?? "lavender") === theme.id}
              onClick={() => onCustomise({ roomTheme: theme.id })}
            ><span aria-hidden="true">{theme.emoji}</span>{theme.label}</button>
          ))}
        </div>
      </section>
    </section>
  );
}
