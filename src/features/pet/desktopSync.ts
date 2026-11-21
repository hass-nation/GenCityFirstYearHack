import { useEffect } from "react";
import type { Pet } from "../../types";
import { DEFAULT_PET_NAME, petSpecies } from "./appearance";

function isLocalPlanner() {
  return ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
}

function updateDesktop(method: "PUT" | "POST", payload: object, signal?: AbortSignal) {
  if (!isLocalPlanner()) return;
  void fetch("/api/desktop-pet", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  }).catch(() => {});
}

export function speakOnDesktop(text: string) {
  updateDesktop("POST", { text: Array.from(text).slice(0, 280).join("") });
}

export function useDesktopAppearance({ name, species, customFrames }: Pet) {
  useEffect(() => {
    const controller = new AbortController();
    const selection = petSpecies({ species, customFrames });
    const timer = window.setTimeout(() => updateDesktop("PUT", {
      name: name.trim() || DEFAULT_PET_NAME,
      species: selection,
      frames: selection === "custom" ? customFrames : undefined,
    }, controller.signal), 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [name, species, customFrames]);
}
