import type { BuiltInPet, Pet, PetSpecies, SpriteFrames } from "../../types.ts";

export const DEFAULT_PET_NAME = "Wobbles";
export const builtInPets: { id: BuiltInPet; label: string }[] = [
  { id: "camel", label: "Camel" },
  { id: "cat", label: "Cat" },
  { id: "dog", label: "Dog" },
];

export function speciesFor(value: unknown): BuiltInPet {
  if (value === "cat" || value === "🐱") return "cat";
  if (value === "dog" || value === "🐶") return "dog";
  return "camel";
}

export function migratePet(pet: Pet): Pet {
  const { avatar, ...saved } = pet;
  if (saved.species) return saved;
  const oldDefault = saved.name === "Pixel" && (avatar === "🐶" || avatar === "🐣" || !avatar);
  return {
    ...saved,
    name: oldDefault ? DEFAULT_PET_NAME : saved.name,
    species: oldDefault ? "camel" : speciesFor(avatar),
  };
}

export function petSpecies(pet: Pick<Pet, "species" | "customFrames">): PetSpecies {
  if (pet.species === "custom" && pet.customFrames?.length === 2) return "custom";
  return speciesFor(pet.species);
}

export async function readSpriteFrame(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 4 * 1024 * 1024) {
    throw new Error("Use a PNG, JPEG or WebP image up to 4 MB for each frame.");
  }
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("One of the images could not be opened. Try a different file.");
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 64;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser could not prepare the sprite.");
    const scale = Math.min(64 / bitmap.width, 64 / bitmap.height);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    context.imageSmoothingEnabled = false;
    context.drawImage(bitmap, Math.floor((64 - width) / 2), Math.floor((64 - height) / 2), width, height);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}

export type AppearanceChange = Partial<Pick<Pet, "species" | "customFrames" | "roomTheme">>;
export type SpriteAppearance = { species?: PetSpecies; customFrames?: SpriteFrames };
