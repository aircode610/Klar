import type { Lang } from "@/types";

/** Web Speech API read-aloud, mapped to a voice locale per language. */
const VOICE: Record<Lang, string> = {
  en: "en-US",
  de: "de-DE",
  fa: "fa-IR",
  tr: "tr-TR",
  ar: "ar-SA",
  uk: "uk-UA",
};

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}

/** Speak text in the given language. Returns false if unsupported. */
export function speak(text: string, lang: Lang, onend?: () => void): boolean {
  if (!speechSupported()) return false;
  stopSpeaking();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = VOICE[lang] ?? "en-US";
  u.rate = 1;
  if (onend) u.onend = onend;
  window.speechSynthesis.speak(u);
  return true;
}
