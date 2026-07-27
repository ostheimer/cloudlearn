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

  const speak = useCallback((text: string) => {
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
    utterance.lang = "de-DE";
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("de"));
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
