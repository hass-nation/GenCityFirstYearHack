import { petSpecies, type SpriteAppearance } from "./appearance";

type Props = SpriteAppearance & { className?: string; still?: boolean };

export default function PetSprite({ species, customFrames, className, still }: Props) {
  const current = petSpecies({ species, customFrames });
  const base = import.meta.env.BASE_URL;
  const frames = current === "custom" && customFrames
    ? customFrames
    : [`${base}pets/${current}-1.png`, `${base}pets/${current}-2.png`];
  return <span className={`pet-sprite${className ? ` ${className}` : ""}`} aria-hidden="true">
    <img src={frames[0]} alt="" draggable={false} />
    {!still && <img className="sprite-next" src={frames[1]} alt="" draggable={false} />}
  </span>;
}
