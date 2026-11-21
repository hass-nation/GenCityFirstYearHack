import type { Pet, PetAction } from "../../types";

type Props = {
  pet: Pet;
  onAction: (action: PetAction) => void;
  onRename: (name: string) => void;
};

function Meter({ label, value, icon }: { label: string; value: number; icon: string }) {
  return (
    <div className="meter">
      <div className="meter-label"><span>{icon} {label}</span><strong>{value}%</strong></div>
      <div className="meter-track"><span style={{ width: `${value}%` }} /></div>
    </div>
  );
}

export default function PetRoom({ pet, onAction, onRename }: Props) {
  return (
    <section className="pet-room content-card">
      <div className="section-heading"><div><p className="eyebrow">YOUR LITTLE FRIEND</p><h2>Pet room</h2></div><span className="count-chip">LEVEL {pet.level}</span></div>
      <div className="pet-stage"><span className="stage-star star-one">✦</span><span className="stage-star star-two">✧</span><div className="pet-large" aria-hidden="true">🐣</div><h3>{pet.name}</h3><p>Just happy to hang out with you.</p><label className="rename-label">Pet name <input value={pet.name} maxLength={16} onChange={(event) => onRename(event.target.value || "Pixel")} /></label></div>
      <div className="pet-controls">
        <Meter label="Hunger" value={100 - pet.hunger} icon="♡" />
        <Meter label="Happiness" value={pet.happiness} icon="☺" />
        <Meter label="Energy" value={pet.energy} icon="☼" />
      </div>
      <div className="action-row"><button onClick={() => onAction("feed")}>🍓 Feed</button><button onClick={() => onAction("play")}>🪀 Play</button><button onClick={() => onAction("rest")}>💤 Rest</button></div>
      <p className="xp-line">✦ {pet.xp} XP · Complete tasks to help {pet.name} level up.</p>
    </section>
  );
}
