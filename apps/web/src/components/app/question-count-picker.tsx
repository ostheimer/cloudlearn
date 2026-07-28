"use client";

import { Minus, Plus } from "@/components/icons";

/**
 * Anzahl-Auswahl für Frage-Runden (Prüfung + Multiple Choice) — wie in der App
 * (apps/mobile/src/components/questionCountPicker.tsx): Vorschlags-Chips
 * (10/20/30/50/75/100, nur unterhalb des Maximums) plus „Alle" und eine
 * Minus/Plus-Feinauswahl für Zwischenwerte (#570). `count >= max` bedeutet
 * „Alle"; Wortlaut und Verhalten müssen mit der App übereinstimmen.
 */
export function QuestionCountPicker({
  count,
  max,
  onChange,
}: {
  count: number;
  max: number;
  onChange: (value: number) => void;
}) {
  // Kein Zahlen-Chip gleich dem Maximum — der würde „Alle" doppeln. Bei
  // kleinen Decks fallen alle Vorschläge weg und nur „Alle (N)" bleibt.
  const presets = [10, 20, 30, 50, 75, 100].filter((n) => n < max);

  return (
    <div className="cl-optcard">
      <div className="cl-dir__lbl">Anzahl Fragen</div>
      <div className="count-chips">
        {presets.map((value) => (
          <button
            key={value}
            type="button"
            className={`count-chip${count === value ? " on" : ""}`}
            onClick={() => onChange(value)}
          >
            {value}
          </button>
        ))}
        <button
          type="button"
          className={`count-chip${count >= max ? " on" : ""}`}
          onClick={() => onChange(max)}
        >
          Alle ({max})
        </button>
      </div>
      <div className="count-fine">
        <button
          type="button"
          className="count-step"
          aria-label="Weniger Fragen"
          disabled={count <= 1}
          onClick={() => onChange(Math.max(1, count - 1))}
        >
          <Minus size={20} />
        </button>
        <div className="count-mid">
          <b>{count >= max ? "Alle" : count}</b>
          <span>von {max}</span>
        </div>
        <button
          type="button"
          className="count-step"
          aria-label="Mehr Fragen"
          disabled={count >= max}
          onClick={() => onChange(Math.min(max, count + 1))}
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
