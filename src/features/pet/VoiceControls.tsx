import { useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};
type VoiceWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export default function VoiceControls({ onCommand }: { onCommand: (transcript: string) => string }) {
  const browser = window as VoiceWindow;
  const Recognition = browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
  const active = useRef<Recognition | null>(null);
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => () => {
    const recognition = active.current;
    if (recognition) {
      recognition.onend = recognition.onerror = recognition.onresult = null;
      recognition.abort();
    }
  }, []);

  function listen() {
    if (!Recognition || active.current) return;
    const recognition = new Recognition();
    active.current = recognition;
    recognition.lang = navigator.language || "en-GB";
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim();
      if (transcript) setMessage(onCommand(transcript));
    };
    recognition.onerror = (event) => setMessage(event.error === "not-allowed"
      ? "Allow microphone access in your browser to use voice commands."
      : event.error === "aborted" ? "Listening stopped." : "Could not recognise speech. Try again or type in chat.");
    recognition.onend = () => {
      active.current = null;
      setListening(false);
    };
    setMessage("");
    try {
      recognition.start();
      setListening(true);
    } catch {
      active.current = null;
      setMessage("Could not start the microphone.");
    }
  }

  return <div className="pet-voice">
    {Recognition ? <button type="button" className="friends-secondary" onClick={listening ? () => active.current?.abort() : listen}>
      {listening ? "Stop listening" : "Voice command"}
    </button> : <p className="muted">Voice commands are unavailable in this browser.</p>}
    {Recognition && <p className="muted">Try “feed pet”, “play”, “rest”, or “open calendar”.</p>}
    <p role="status">{listening && !message ? "Listening…" : message}</p>
  </div>;
}
