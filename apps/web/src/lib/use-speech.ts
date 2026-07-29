"use client";

// Dünne Hülle um die eingebaute Browser-Sprachausgabe (window.speechSynthesis).
// Mobile-Gegenstück: expo-speech in apps/mobile/app/(tabs)/learn.tsx.
// Gekapselte Eigenheiten:
// - supported: abgespeckte Browser haben kein speechSynthesis; die Aufrufer
//   blenden ihre Vorlese-Knöpfe dann ganz aus.
// - Stimmen laden in manchen Browsern asynchron nach, deshalb wird die Liste
//   bei jedem speak() neu abgefragt statt einmal beim Start.
// - Beim Unmount wird abgebrochen, sonst redet die Stimme nach dem Verlassen
//   der Seite einfach weiter.

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_SPEECH_LANGUAGE } from "./speech-languages";

export function useSpeech() {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  // Nur die zuletzt gestartete Äußerung darf den Sprech-Zustand zurücksetzen —
  // das onend einer gerade abgebrochenen alten Äußerung würde sonst den Knopf
  // ausschalten, während die neue noch spricht.
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    setSupported(true);
    return () => window.speechSynthesis.cancel();
  }, []);

  const stop = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    utteranceRef.current = null;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  // `lang` ist ein BCP-47-Code aus der Deck-Einstellung (#571). Ohne Angabe
  // bleibt es bei Deutsch — dem Verhalten, das es vor der Einstellung gab.
  const speak = useCallback((text: string, lang: string = DEFAULT_SPEECH_LANGUAGE) => {
    if (!("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const trimmed = text.trim();
    if (!trimmed) {
      utteranceRef.current = null;
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(trimmed);
    utterance.lang = lang;
    // Nach dem Sprachteil vergleichen ("fr" aus "fr-FR"): Browser liefern die
    // Stimme oft unter einer anderen Region aus (fr-CA statt fr-FR), und eine
    // französische Stimme aus Kanada ist unendlich viel besser als eine
    // deutsche. Findet sich gar nichts, entscheidet der Browser anhand von
    // `utterance.lang` selbst.
    const base = lang.split("-")[0]?.toLowerCase() ?? "de";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(base));
    if (voice) utterance.voice = voice;
    const settle = () => {
      if (utteranceRef.current === utterance) setSpeaking(false);
    };
    utterance.onend = settle;
    utterance.onerror = settle;
    utteranceRef.current = utterance;
    setSpeaking(true);
    synth.speak(utterance);
  }, []);

  return { supported, speaking, speak, stop };
}
