/**
 * Der Ein-Schritt-Puffer hinter dem Zurück-Pfeil der Web-Lernansicht
 * (Gegenstück zum App-Puffer aus #283). Entscheidend ist die Reihenfolge:
 * Eine Bewertung geht erst raus, wenn die NÄCHSTE Karte bewertet wurde —
 * nur dann kann Zurück die letzte Bewertung folgenlos verwerfen.
 */

import { describe, expect, it } from "vitest";
import { createReviewSendBuffer } from "./review-send-buffer";

describe("review send buffer", () => {
  it("holds the first rating back instead of releasing it", () => {
    const buffer = createReviewSendBuffer();
    expect(buffer.rate({ cardId: "k1", rating: "good" })).toBeNull();
    expect(buffer.hasPending()).toBe(true);
  });

  it("releases the previous rating once the next card is rated", () => {
    const buffer = createReviewSendBuffer();
    buffer.rate({ cardId: "k1", rating: "good" });
    expect(buffer.rate({ cardId: "k2", rating: "again" })).toEqual({
      cardId: "k1",
      rating: "good",
    });
  });

  it("lets going back discard the held rating — no double review", () => {
    const buffer = createReviewSendBuffer();
    buffer.rate({ cardId: "k1", rating: "again" });
    buffer.back();
    expect(buffer.hasPending()).toBe(false);
    // Neu bewerten liefert nichts Altes zum Senden — k1 bekommt am Ende
    // genau eine Bewertung.
    expect(buffer.rate({ cardId: "k1", rating: "good" })).toBeNull();
    expect(buffer.flush()).toEqual({ cardId: "k1", rating: "good" });
  });

  it("flushes exactly once at the end of a round", () => {
    const buffer = createReviewSendBuffer();
    buffer.rate({ cardId: "k9", rating: "easy" });
    expect(buffer.flush()).toEqual({ cardId: "k9", rating: "easy" });
    expect(buffer.flush()).toBeNull();
    expect(buffer.hasPending()).toBe(false);
  });
});
