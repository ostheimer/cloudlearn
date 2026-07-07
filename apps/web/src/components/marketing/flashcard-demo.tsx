"use client";

import { useState } from "react";

interface DemoCard {
  label: string;
  front: string;
  back: string;
}

const CARDS: DemoCard[] = [
  {
    label: "Biologie",
    front: "Was ist die Funktion der Mitochondrien?",
    back: "Kraftwerk der Zelle — sie erzeugen Energie (ATP) durch Zellatmung.",
  },
  {
    label: "Geschichte",
    front: "Wann fiel die Berliner Mauer?",
    back: "Am 9. November 1989.",
  },
  {
    label: "Mathematik",
    front: "Wie lautet der Satz des Pythagoras?",
    back: "a² + b² = c² — im rechtwinkligen Dreieck.",
  },
];

export function FlashcardDemo() {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = CARDS[index] ?? CARDS[0]!;

  function next() {
    setFlipped(false);
    // Give the flip-back animation a moment before swapping content.
    window.setTimeout(() => setIndex((i) => (i + 1) % CARDS.length), 180);
  }

  return (
    <div>
      <div
        className={`flip${flipped ? " is-flipped" : ""}`}
        role="button"
        tabIndex={0}
        aria-label="Karte umdrehen"
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((v) => !v);
          }
        }}
      >
        <div className="flip__inner">
          <div className="flip__face flip__face--front">
            <span className="flip__label">{card.label} · Frage</span>
            <span className="flip__q">{card.front}</span>
            <span className="flip__hint">Tippen zum Umdrehen ↻</span>
          </div>
          <div className="flip__face flip__face--back">
            <span className="flip__label">Antwort</span>
            <span className="flip__q">{card.back}</span>
            <span className="flip__hint">Wie gut wusstest du es?</span>
          </div>
        </div>
      </div>

      <div className="rating-row" aria-hidden={!flipped}>
        <button type="button" className="rating rating--again" onClick={next}>
          Nochmal
        </button>
        <button type="button" className="rating rating--hard" onClick={next}>
          Schwer
        </button>
        <button type="button" className="rating rating--good" onClick={next}>
          Gut
        </button>
        <button type="button" className="rating rating--easy" onClick={next}>
          Leicht
        </button>
      </div>

      <div className="demo-dots" aria-hidden>
        {CARDS.map((c, i) => (
          <i key={c.label} className={i === index ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
