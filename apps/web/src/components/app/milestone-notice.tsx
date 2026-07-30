"use client";

import { useEffect, useRef, useState } from "react";
import { milestoneLabel, onMilestones, type MilestoneAward } from "@/lib/milestones";
import { Award, X } from "@/components/icons";

/**
 * Der Hinweis „Meilenstein erreicht" (#637).
 *
 * Hängt EINMAL in der App-Hülle statt in jedem Bildschirm: ausgelöst wird er
 * vom gemeinsamen fetch-Wrapper, sobald der Server einen Bonus gutgeschrieben
 * hat. Damit erscheint er überall — nach dem ersten Deck, nach dem Speichern
 * aus dem Scan, am Ende jeder Lernart und nach einer Prüfung — ohne dass eine
 * einzelne Seite daran denken muss.
 *
 * Nie mitten im Lernen (Laras Entscheidung): Die Boni fürs Lernen entstehen
 * beim Abrechnen der Sitzung, also erst auf dem Ergebnis-Bildschirm. Der
 * Hinweis kann eine laufende Karte deshalb gar nicht überdecken.
 */
const AUTO_HIDE_MS = 6000;

export function MilestoneNotice() {
  const [queue, setQueue] = useState<MilestoneAward[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => onMilestones((awards) => {
    // Anhängen statt ersetzen: Wer in derselben Sitzung die erste Runde
    // beendet UND den 7-Tage-Streak knackt, soll beide Boni sehen.
    setQueue((current) => [...current, ...awards]);
  }), []);

  const current = queue[0] ?? null;

  useEffect(() => {
    if (!current) return;
    timerRef.current = window.setTimeout(() => {
      setQueue((rest) => rest.slice(1));
    }, AUTO_HIDE_MS);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
    // Am Schlüssel hängen, nicht am Objekt: Eine neue Liste mit demselben
    // vordersten Bonus soll die laufende Anzeigedauer nicht neu starten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.key]);

  if (!current) return null;

  return (
    <div className="ms-note" role="status" aria-live="polite">
      <span className="ms-note__ic" aria-hidden>
        <Award size={20} />
      </span>
      <span className="ms-note__txt">
        <span className="ms-note__t">Meilenstein erreicht</span>
        <span className="ms-note__s">
          {milestoneLabel(current.key)} · +{current.lpGranted} Lernpunkte
        </span>
      </span>
      <button
        type="button"
        className="ms-note__x"
        aria-label="Hinweis schließen"
        onClick={() => setQueue((rest) => rest.slice(1))}
      >
        <X size={16} />
      </button>
    </div>
  );
}
