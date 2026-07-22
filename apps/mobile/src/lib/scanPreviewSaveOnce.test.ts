import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * #442: Der Scan legte zwei identische Decks an — der Server beim Erzeugen, die
 * App beim „Speichern". Der Fix ist, dass ALLE vier Erzeugungs-Wege mit
 * `preview` aufrufen: Dann speichert der Server nichts, und nur die App legt das
 * eine Deck an.
 *
 * Die api-Funktionen sind separat geprüft (apiImportIdempotency.test.ts); dieser
 * Test nagelt fest, dass die Scan-Seite den Schalter auch WIRKLICH setzt — sonst
 * kommt der Doppel-Deck-Bug still zurück. scan.tsx als große RN-Komponente lässt
 * sich schlecht rendern, deshalb (wie im Web) als Quelltext-Prüfung.
 */
describe("Scan-Seite ruft alle vier Wege im Vorschau-Modus (#442)", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../app/(tabs)/scan.tsx"),
    "utf-8"
  ).replace(/\r\n/g, "\n");

  const calls = [
    { name: "scanText", re: /scanText\([^)]*\)/s },
    { name: "scanImage", re: /scanImage\([^)]*\)/s },
    { name: "importFromUrl", re: /importFromUrl\([^)]*\)/s },
    { name: "importPdf", re: /importPdf\([^)]*\)/s },
  ];

  it("verwendet genau diese vier Erzeugungs-Aufrufe", () => {
    for (const { name, re } of calls) {
      expect(source, `${name} fehlt`).toMatch(re);
    }
  });

  it("übergibt jedem Aufruf preview = true (letztes Argument)", () => {
    for (const { name, re } of calls) {
      const call = source.match(re)?.[0] ?? "";
      // Der Aufruf endet auf „…, idempotencyKey, true)". Ohne das letzte true
      // speichert der Server sofort und der zweite Deck entsteht wieder.
      expect(call, `${name} ohne preview=true`).toMatch(/,\s*true\s*\)$/);
    }
  });
});

describe("Karten-Vorschau ist bearbeitbar und löschbar (#427)", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../app/(tabs)/scan.tsx"),
    "utf-8"
  ).replace(/\r\n/g, "\n");

  it("bindet die Textfelder an editCard (sonst nur Ansehen wie früher)", () => {
    expect(source).toMatch(/editCard\(idx,\s*"front"/);
    expect(source).toMatch(/editCard\(idx,\s*"back"/);
  });

  it("hat je Karte einen Löschen-Knopf, der removeCard ruft", () => {
    expect(source).toMatch(/onPress=\{\(\)\s*=>\s*removeCard\(idx\)\}/);
    expect(source).toContain("Trash2");
  });

  it("speichert weiter aus dem cards-State — Änderungen fließen automatisch mit", () => {
    // saveCardsToDeck liest `cards`; editCard/removeCard schreiben dorthin.
    // Verlöre eine der beiden Funktionen ihren setCards-Aufruf, ginge die
    // Bearbeitung ins Leere.
    expect(source).toContain("setCards((prev) => editCardField(prev, index, side, value))");
    expect(source).toContain("setCards((prev) => removeCardAt(prev, index))");
  });
});
