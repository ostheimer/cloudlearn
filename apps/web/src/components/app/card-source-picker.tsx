"use client";

import { Star } from "@/components/icons";
import type { CardSource } from "@/lib/card-source";

/**
 * Auswahl der Kartenquelle vor dem Start eines Lernmodus — wie in der App
 * (apps/mobile/src/components/cardSourcePicker.tsx): drei Radio-Reihen mit
 * Anzahl in Klammern. „Nur markierte" und „Nur Wackelkandidaten" sind
 * ausgegraut und nicht wählbar, solange sie 0 Karten haben. „Nur markierte"
 * ist zugleich die Funktion des Sterns auf der Deck-Seite (#523).
 */
export function CardSourcePicker({
  value,
  onChange,
  allCount,
  starredCount,
  wobblyCount,
}: {
  value: CardSource;
  onChange: (source: CardSource) => void;
  allCount: number;
  starredCount: number;
  wobblyCount: number;
}) {
  const rows: { key: CardSource; label: string; count: number; star?: boolean }[] = [
    { key: "all", label: "Alle Karten", count: allCount },
    { key: "starred", label: "Nur markierte", count: starredCount, star: true },
    { key: "wobbly", label: "Nur Wackelkandidaten", count: wobblyCount },
  ];

  return (
    <div className="cl-optcard src-pick" role="radiogroup" aria-label="Kartenquelle">
      <div className="cl-dir__lbl">Kartenquelle</div>
      {rows.map((row) => {
        // „Alle" ist nie leer genug zum Sperren (der Modus wäre sonst gar nicht
        // erreichbar); die beiden anderen sperren bei 0.
        const disabled = row.count === 0 && row.key !== "all";
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
            <span className="src-opt__lbl">
              {row.star && <Star size={15} className="src-opt__star" />}
              {row.label}
            </span>
            <span className="src-opt__cnt">({row.count})</span>
          </button>
        );
      })}
    </div>
  );
}
