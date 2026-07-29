"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import { createCard, createDeck } from "@/lib/api";
import {
  isOnboardingCompleted,
  markOnboardingCompleted,
  rememberFreshWelcome,
} from "@/lib/onboarding";
import { GraduationCap, RotateCw, Sparkles, Layers } from "@/components/icons";

// Gleiches Starter-Deck wie die App beim ersten Start anlegt.
const SAMPLE_DECK_TITLE = "Erste Karten";
const SAMPLE_CARDS: { front: string; back: string }[] = [
  { front: "Hund", back: "dog" },
  { front: "Katze", back: "cat" },
  { front: "Vogel", back: "bird" },
];

// Texte wie in der App; Schritt 2 an den Browser angepasst (klicken statt
// wischen, bewertet wird mit den vier Knöpfen der Karteikarten-Seite).
const STEPS: { Icon: typeof Layers; title: string; subtitle: string }[] = [
  {
    Icon: GraduationCap,
    title: "Willkommen bei clearn",
    subtitle: "Lerne mit KI-generierten Karteikarten. Schnell, smart, nachhaltig.",
  },
  {
    Icon: RotateCw,
    title: "So funktioniert's",
    subtitle:
      "Klicke auf die Karte, um sie umzudrehen, und bewerte dann ehrlich: „Nochmal“, „Schwer“, „Gut“ oder „Leicht“.",
  },
  {
    // Gleiches Funken-Symbol wie der Scan-Menüpunkt, damit der Wiedererkennungs-
    // Effekt trägt. Den Schritt gibt es inzwischen auch in der App
    // (onboarding.scanTitle) — er startete hier im Web (Laras Wunsch 27.07.).
    Icon: Sparkles,
    title: "Karten aus Fotos",
    subtitle:
      "Fotografiere deine Notizen oder lade ein PDF hoch — die KI macht daraus fertige Karteikarten. Du findest das jederzeit unter „Scan“.",
  },
  {
    Icon: Layers,
    title: "Dein erstes Deck",
    subtitle: "Wir legen dir 3 Beispielkarten an. Danach kannst du sofort loslegen.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { status, userId } = useAuth();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Wer den Haken schon hat, gehört ins Dashboard, nicht hierher.
  useEffect(() => {
    if (isOnboardingCompleted()) router.replace("/dashboard/home");
  }, [router]);

  const handleStart = async () => {
    if (!userId || creating) return;
    setError(null);
    setCreating(true);
    try {
      const { deck } = await createDeck(userId, SAMPLE_DECK_TITLE);
      for (const card of SAMPLE_CARDS) {
        await createCard(userId, deck.id, { front: card.front, back: card.back });
      }
      markOnboardingCompleted();
      rememberFreshWelcome();
      router.replace("/dashboard/home");
    } catch {
      setError("Starter-Deck konnte nicht erstellt werden. Bitte später erneut versuchen.");
      setCreating(false);
    }
  };

  if (status !== "authenticated") {
    return (
      <div className="center-screen">
        <div className="spinner" />
      </div>
    );
  }

  const current = STEPS[step]!;
  const isLastStep = step === STEPS.length - 1;

  return (
    <main className="onboarding">
      <div className="onboarding__dots" aria-hidden>
        {STEPS.map((_, i) => (
          <span key={i} className={`onboarding__dot${i <= step ? " is-on" : ""}`} />
        ))}
      </div>

      <div className="onboarding__body">
        <span className="onboarding__icon">
          <current.Icon size={28} />
        </span>
        <h1 className="onboarding__title">{current.title}</h1>
        <p className="onboarding__text">{current.subtitle}</p>
        {error ? <p className="form-error">{error}</p> : null}
      </div>

      <div className="onboarding__footer">
        {creating ? (
          <div className="onboarding__creating">
            <div className="spinner" />
            <p>Erstelle dein erstes Deck…</p>
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            onClick={isLastStep ? handleStart : () => setStep((s) => s + 1)}
          >
            {isLastStep ? "Jetzt starten" : "Weiter"}
          </button>
        )}
      </div>
    </main>
  );
}
