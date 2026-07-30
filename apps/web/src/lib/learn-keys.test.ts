/**
 * Tastensteuerung der Lernansicht (#610). Geprüft werden die Fälle, in denen
 * ein Tastendruck NICHT bewerten darf — die harmlosen sieht man sofort, die
 * gefährlichen nicht: eine Karte bewerten, deren Antwort noch verdeckt ist,
 * oder eine Ziffer abfangen, die jemand in ein Feld tippt.
 */

import { describe, expect, it } from "vitest";
import { ratingKeyIndex, shouldAdvanceOnEnter } from "./learn-keys";

describe("ratingKeyIndex", () => {
  it("bildet 1 bis 4 auf die vier Knöpfe ab (Nochmal, Schwer, Gut, Leicht)", () => {
    expect(ratingKeyIndex({ key: "1" }, true)).toBe(0);
    expect(ratingKeyIndex({ key: "2" }, true)).toBe(1);
    expect(ratingKeyIndex({ key: "3" }, true)).toBe(2);
    expect(ratingKeyIndex({ key: "4" }, true)).toBe(3);
  });

  it("bewertet nichts, solange die Karte nicht umgedreht ist", () => {
    expect(ratingKeyIndex({ key: "3" }, false)).toBeNull();
  });

  it("ignoriert andere Tasten", () => {
    expect(ratingKeyIndex({ key: "5" }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "0" }, true)).toBeNull();
    expect(ratingKeyIndex({ key: " " }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "Enter" }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "a" }, true)).toBeNull();
  });

  it("lässt Browser-Kürzel in Ruhe (Strg/Cmd/Alt + Ziffer)", () => {
    expect(ratingKeyIndex({ key: "1", ctrlKey: true }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "1", metaKey: true }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "1", altKey: true }, true)).toBeNull();
  });

  it("schluckt keine Ziffer, die in ein Feld getippt wird", () => {
    expect(ratingKeyIndex({ key: "2", targetTag: "INPUT" }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "2", targetTag: "textarea" }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "2", targetTag: "SELECT" }, true)).toBeNull();
    expect(ratingKeyIndex({ key: "2", targetIsEditable: true }, true)).toBeNull();
  });

  it("bewertet weiter, wenn die Taste auf einem Knopf oder der Karte landet", () => {
    expect(ratingKeyIndex({ key: "3", targetTag: "BUTTON" }, true)).toBe(2);
    expect(ratingKeyIndex({ key: "3", targetTag: "DIV" }, true)).toBe(2);
  });
});

describe("shouldAdvanceOnEnter", () => {
  it("blättert bei Enter weiter", () => {
    expect(shouldAdvanceOnEnter({ key: "Enter" })).toBe(true);
    expect(shouldAdvanceOnEnter({ key: "Enter", targetTag: "DIV" })).toBe(true);
  });

  it("lässt Enter auf einem Knopf dem Knopf", () => {
    // „Trotzdem als richtig zählen" soll gelten lassen, nicht weiterblättern.
    expect(shouldAdvanceOnEnter({ key: "Enter", targetTag: "BUTTON" })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: "Enter", targetTag: "a" })).toBe(false);
  });

  it("reagiert nur auf Enter und nicht mit Zusatztasten", () => {
    expect(shouldAdvanceOnEnter({ key: " " })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: "1" })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: "Enter", ctrlKey: true })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: "Enter", metaKey: true })).toBe(false);
    expect(shouldAdvanceOnEnter({ key: "Enter", altKey: true })).toBe(false);
  });
});
