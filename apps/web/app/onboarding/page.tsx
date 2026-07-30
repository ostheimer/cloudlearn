"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import { createCard, createDeck } from "@/lib/api";
import {
  REPLAY_PARAM,
  isOnboardingCompleted,
  markOnboardingCompleted,
  rememberFreshWelcome,
} from "@/lib/onboarding";
import { GraduationCap, RotateCw, Sparkles, Layers, Zap } from "@/components/icons";

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
    // #609: Die vier Knöpfe wurden nur aufgezählt, nie erklärt. Wortlaut
    // „gewusst" wie in der App (Laras Entscheidung) — dort heißt auch das
    // Wisch-Overlay jetzt „GEWUSST".
    Icon: RotateCw,
    title: "So funktioniert's",
    subtitle:
      "Klicke auf die Karte, um sie umzudrehen, und bewerte dann ehrlich: „Nochmal“ (gar nicht gewusst), „Schwer“ (nur mit Mühe), „Gut“ (gewusst), „Leicht“ (sofort klar). Je nach Bewertung kommt die Karte früher oder später wieder.",
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
    // Lernpunkte erklären, bevor die ersten weg sind (#609, Laras Wortlaut) —
    // gleicher Blitz wie die LP-Pille. Denselben Schritt hat auch die App
    // (onboarding.lpTitle).
    Icon: Zap,
    title: "Was sind Lernpunkte?",
    subtitle:
      "Lernpunkte (LP) sind das Guthaben der App: Du verdienst sie durchs Lernen — 1 LP für jede gelernte Karte — und gibst sie aus, wenn die KI für dich arbeitet, zum Beispiel beim Scannen. Lernen selbst ist immer gratis.",
  },
  {
    // #609: „kannst du löschen" gehört dazu — sonst wirken die drei
    // Tier-Karten wie ein fester Teil der App.
    Icon: Layers,
    title: "Dein erstes Deck",
    subtitle:
      "Wir legen dir 3 Beispielkarten an — die kannst du jederzeit löschen. Danach kannst du sofort loslegen.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { status, userId } = useAuth();
  const [step, setStep] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // #609: Freiwilliges zweites Ansehen (Profil → „Einführung erneut ansehen").
  // Dann entsteht am Ende KEIN zweites Beispiel-Deck und der Haken bleibt, wie
  // er ist. Aus window statt useSearchParams gelesen, damit die Seite ohne
  // Suspense-Grenze auskommt; `paramsRead` verhindert, dass die Weiterleitung
  // unten schon feuert, bevor der Merker bekannt ist.
  const [replay, setReplay] = useState(false);
  const [paramsRead, setParamsRead] = useState(false);

  useEffect(() => {
    setReplay(new URLSearchParams(window.location.search).get(REPLAY_PARAM) === "1");
    setParamsRead(true);
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  // Wer den Haken schon hat, gehört ins Dashboard, nicht hierher — außer er
  // will die Einführung ausdrücklich noch einmal sehen.
  useEffect(() => {
    if (!paramsRead || replay) return;
    if (isOnboardingCompleted()) router.replace("/dashboard/home");
  }, [paramsRead, replay, router]);

  /**
   * #609: Überspringen legt bewusst KEINE Beispielkarten an — sonst wäre es
   * kein Überspringen. Der Haken wird trotzdem gesetzt, damit die Einführung
   * nicht bei jedem Besuch wieder erscheint; über das Profil ist sie jederzeit
   * erneut erreichbar.
   */
  const handleSkip = () => {
    if (creating) return;
    markOnboardingCompleted();
    rememberFreshWelcome();
    router.replace("/dashboard/home");
  };

  /** Zweites Ansehen: nichts anlegen, nichts merken, einfach zurück. */
  const handleFinishReplay = () => {
    router.replace("/dashboard/home");
  };

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
      <div className="onboarding__nav">
        <button
          type="button"
          className={`onboarding__navbtn${step === 0 ? " is-invisible" : ""}`}
          onClick={() => setStep((s) => Math.max(s - 1, 0))}
          disabled={step === 0 || creating}
          aria-hidden={step === 0}
          tabIndex={step === 0 ? -1 : undefined}
        >
          Zurück
        </button>

        <div className="onboarding__dots" aria-hidden>
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding__dot${i <= step ? " is-on" : ""}`} />
          ))}
        </div>

        {/* Beim zweiten Ansehen sagt auf dem letzten Schritt schon der große
            Knopf „Fertig" — oben nochmal wäre doppelt. */}
        <button
          type="button"
          className={`onboarding__navbtn${replay && isLastStep ? " is-invisible" : ""}`}
          onClick={replay ? handleFinishReplay : handleSkip}
          disabled={creating || (replay && isLastStep)}
          aria-hidden={replay && isLastStep}
          tabIndex={replay && isLastStep ? -1 : undefined}
        >
          {replay ? "Fertig" : "Überspringen"}
        </button>
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
            onClick={
              // Beim zweiten Ansehen entsteht kein weiteres Beispiel-Deck (#609).
              isLastStep
                ? replay
                  ? handleFinishReplay
                  : handleStart
                : () => setStep((s) => s + 1)
            }
          >
            {isLastStep ? (replay ? "Fertig" : "Jetzt starten") : "Weiter"}
          </button>
        )}
      </div>
    </main>
  );
}
