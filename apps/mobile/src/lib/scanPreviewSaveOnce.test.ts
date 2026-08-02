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

  it("entscheidet Editierbarkeit über die Medien-Analyse, nicht über plainFront", () => {
    // Der Geräte-Bug: `plainFront`/`plainBack` sind IMMER gesetzt, also darf die
    // Editier-Sperre NICHT daran hängen. Nur die fertige Analyse (isCardEditable)
    // ist erlaubt; ein Rückfall auf plainFront würde wieder alles sperren.
    expect(source).toContain("isCardEditable(card, media)");
    expect(source).not.toMatch(/plainFront\s*\|\|\s*media\.plainBack/);
  });

  it("warnt vor dem Verwerfen ungespeicherter Karten (#442)", () => {
    // „Neuen Scan starten" wirft die bezahlten Karten weg — vorher fragen, sonst
    // sind Karten UND Lernpunkte still weg (am Gerät passiert).
    expect(source).toContain("onPress={startNewScan}");
    expect(source).toMatch(/!saved && cards\.length > 0/);
    expect(source).toContain("Lernpunkte kommen nicht zurück");
  });

  it("kann eine Karte von Hand hinzufügen und überspringt leere beim Speichern (#427)", () => {
    expect(source).toContain("onPress={addCard}");
    expect(source).toContain("setCards((prev) => [...prev, blankCard()])");
    // Speichern filtert leere Karten raus, sonst reißt der Server-Check.
    expect(source).toContain("const savable = nonEmptyCards(cards)");
  });

  it("verdrahtet den Ziehgriff zum Sortieren (#427)", () => {
    // Ein geteilter PanResponder, der Griff meldet per onTouchStart seine Karte,
    // und die Reihenfolge wird über moveCard im cards-State getauscht.
    expect(source).toContain("gripResponder.panHandlers");
    expect(source).toContain("pendingIndexRef.current = idx");
    expect(source).toMatch(/setCards\(\(prev\) => moveCard\(prev, from, from [+-] 1\)\)/);
    expect(source).toContain("<GripVertical");
  });
});

describe("zu teure Scan-Quellen erklären ihren Ausweg (#701)", () => {
  const source = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../app/(tabs)/scan.tsx"),
    "utf-8"
  ).replace(/\r\n/g, "\n");

  it("lässt die Kacheln antippbar, damit sie das LP-Fenster öffnen können", () => {
    expect(source).not.toContain("disabled={!afford.aiScan}");
    expect(source).not.toContain("disabled={!afford.urlImport}");
    expect(source).not.toContain("disabled={!afford.pdfImport}");
    expect(source).toContain('openScanSource("urlImport", lpCostUrlImport, afford.urlImport');
    expect(source).toContain('openScanSource("pdfImport", lpCostPdfImport, afford.pdfImport');
  });
});
