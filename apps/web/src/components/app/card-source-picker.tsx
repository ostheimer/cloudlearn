"use client";

import { Star } from "@/components/icons";
import type { CardSource } from "@/lib/card-source";

/**
 * Auswahl der Kartenquelle vor dem Start eines Lernmodus — wie in der App
 * (apps/mobile/src/components/cardSourcePicker.tsx): vier Radio-Reihen mit
 * Anzahl in Klammern. „Nur fällige" steht oben — das ist die Alltagswahl
 * (#610): die Karten, die der Lernplan heute wiederholen will. Reihen außer
 * „Alle" sind ausgegraut und nicht wählbar, solange sie zu wenige Karten
 * haben. „Nur markierte" ist zugleich die Funktion des Sterns auf der
 * Deck-Seite (#523).
 *
 * `minCount` ist die Mindestzahl Karten, die ein Modus zum Starten braucht
 * (Standard 1). Multiple Choice und Zuordnen setzen 2: dort ergibt eine
 * einzelne Karte keine Aufgabe (MC braucht eine zweite Karte als Ablenker,
 * Zuordnen ein zweites Paar). Ohne diese Schwelle sah „Nur markierte (1)"
 * wählbar aus und führte in eine leere „Keine Fragen"-Seite (#533 Punkt 1).
 */
export function CardSourcePicker({
  value,
  onChange,
  allCount,
  starredCount,
  wobblyCount,
  dueCount,
  minCount = 1,
}: {
  value: CardSource;
  onChange: (source: CardSource) => void;
  allCount: number;
  starredCount: number;
  wobblyCount: number;
  dueCount: number;
  minCount?: number;
}) {
  const rows: { key: CardSource; label: string; count: number; star?: boolean }[] = [
    { key: "due", label: "Nur fällige", count: dueCount },
    { key: "all", label: "Alle Karten", count: allCount },
    { key: "starred", label: "Nur markierte", count: starredCount, star: true },
    { key: "wobbly", label: "Nur Wackelkandidaten", count: wobblyCount },
  ];

  return (
    <div className="cl-optcard src-pick" role="radiogroup" aria-label="Kartenquelle">
      <div className="cl-dir__lbl">Kartenquelle</div>
      {rows.map((row) => {
        // „Alle" ist nie leer genug zum Sperren (der Modus wäre sonst gar nicht
        // erreichbar); die beiden anderen sperren unter der Mindestzahl.
        const disabled = row.count < minCount && row.key !== "all";
        // Hinweis nur, wenn welche da sind, aber zu wenige — „(0)" erklärt sich
        // selbst, „(1) mit Sperre" dagegen nicht.
        const tooFew = disabled && row.count > 0;
        const active = value === row.key;
        return (
          <button
            key={row.key}
            type="button"
            className={`src-opt${active ? " on" : ""}`}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(row.key)}
          >
            <span className="src-opt__radio" aria-hidden>
              <i />
            </span>
            <span className="src-opt__text">
              <span className="src-opt__lbl">
                {row.star && <Star size={15} className="src-opt__star" />}
                {row.label}
              </span>
              {tooFew && (
                <span className="src-opt__hint">mind. {minCount} Karten</span>
              )}
            </span>
            <span className="src-opt__cnt">({row.count})</span>
          </button>
        );
      })}
    </div>
  );
}
