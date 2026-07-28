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

  // „Trotzdem als richtig zählen" (#567): Die Karte muss am Ende genau EIN
  // „gut" tragen — kein „falsch" plus „gut" obendrauf.
  it("amend replaces the held rating in place", () => {
    const buffer = createReviewSendBuffer();
    buffer.rate({ cardId: "k1", rating: "again" });
    expect(buffer.amend("k1", "good")).toBe(true);
    expect(buffer.flush()).toEqual({ cardId: "k1", rating: "good" });
  });

  it("amend declines when the card's rating is already on its way", () => {
    const buffer = createReviewSendBuffer();
    buffer.rate({ cardId: "k1", rating: "again" });
    buffer.rate({ cardId: "k2", rating: "good" });
    // k1 wurde beim Bewerten von k2 freigegeben — zu spät zum Ersetzen; der
    // Aufrufer muss ersatzweise eine korrigierende Bewertung schicken.
    expect(buffer.amend("k1", "good")).toBe(false);
    expect(buffer.flush()).toEqual({ cardId: "k2", rating: "good" });
  });

  it("flushes exactly once at the end of a round", () => {
    const buffer = createReviewSendBuffer();
    buffer.rate({ cardId: "k9", rating: "easy" });
    expect(buffer.flush()).toEqual({ cardId: "k9", rating: "easy" });
    expect(buffer.flush()).toBeNull();
    expect(buffer.hasPending()).toBe(false);
  });
});
