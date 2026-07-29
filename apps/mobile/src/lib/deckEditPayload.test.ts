import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDeckUpdatePayload, parseTagsText } from "./deckEditPayload";

// #606: „Deck bearbeiten" schickte immer `tags: []` mit, weil der aufrufende
// Bildschirm die Schlagwörter nie lädt (sein Wert startet leer). Jede
// Titelkorrektur löschte damit still alle Schlagwörter. Gleiche Falle bei den
// Vorlese-Sprachen: Schlug das Nachladen fehl, ging der Standardwert „de-DE"
// mit und überschrieb die gespeicherte Einstellung.

const baseInput = {
  title: "Bio Kapitel 3",
  tagsText: "",
  tagsEdited: false,
  langFront: "de-DE",
  langFrontEdited: false,
  langBack: "de-DE",
  langBackEdited: false,
  detailsLoaded: false,
};

describe("buildDeckUpdatePayload – unbekannte Felder bleiben weg", () => {
  it("Titel ändern ohne geladene Details ⇒ Tags und Sprachen werden NICHT mitgeschickt", () => {
    // Das Kern-Szenario aus #606: Laden schlug fehl (oder lief noch), die
    // Nutzerin ändert nur den Titel. Ein fehlendes Feld lässt der Server in
    // Ruhe — `tags: []` hätte er dagegen als „alle löschen" verstanden.
    const payload = buildDeckUpdatePayload(baseInput);
    expect(payload).toEqual({ title: "Bio Kapitel 3" });
    expect("tags" in payload).toBe(false);
    expect("speechLangFront" in payload).toBe(false);
    expect("speechLangBack" in payload).toBe(false);
  });

  it("mit geladenen Details gehen Tags und beide Sprachen mit", () => {
    const payload = buildDeckUpdatePayload({
      ...baseInput,
      tagsText: "scan, auto",
      langFront: "en-US",
      detailsLoaded: true,
    });
    expect(payload).toEqual({
      title: "Bio Kapitel 3",
      tags: ["scan", "auto"],
      speechLangFront: "en-US",
      speechLangBack: "de-DE",
    });
  });

  it("selbst getippte Schlagwörter gehen auch ohne geladene Details mit", () => {
    // Eigene Eingabe ist eine bewusste Entscheidung — die darf nicht im
    // Sicherheitsnetz hängen bleiben.
    const payload = buildDeckUpdatePayload({
      ...baseInput,
      tagsText: " bio ,, chemie ",
      tagsEdited: true,
    });
    expect(payload.tags).toEqual(["bio", "chemie"]);
    expect("speechLangFront" in payload).toBe(false);
  });

  it("nur die selbst umgestellte Sprachseite geht mit, die andere bleibt unangetastet", () => {
    const payload = buildDeckUpdatePayload({
      ...baseInput,
      langFront: "fr-FR",
      langFrontEdited: true,
    });
    expect(payload.speechLangFront).toBe("fr-FR");
    expect("speechLangBack" in payload).toBe(false);
  });

  it("trimmt den Titel", () => {
    expect(buildDeckUpdatePayload({ ...baseInput, title: "  Physik  " }).title).toBe("Physik");
  });
});

describe("parseTagsText", () => {
  it("zerlegt am Komma, trimmt und wirft Leeres weg", () => {
    expect(parseTagsText(" bio , , chemie ,")).toEqual(["bio", "chemie"]);
    expect(parseTagsText("")).toEqual([]);
  });
});

describe("DeckEditModal – Verdrahtung des Fixes (#606)", () => {
  const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const source = readFileSync(
    join(mobileRoot, "src/components/DeckEditModal.tsx"),
    "utf-8"
  ).replace(/\r\n/g, "\n");

  it("baut die Speicher-Nutzlast über buildDeckUpdatePayload", () => {
    // Ohne den Helfer wäre die Nur-mitschicken-wenn-bekannt-Regel wieder weg.
    expect(source).toContain("buildDeckUpdatePayload({");
    expect(source).not.toMatch(/updateDeck\(deckId,\s*\{\s*title/);
  });

  it("übernimmt die echten Schlagwörter aus der Server-Antwort ins Eingabefeld", () => {
    // Der aufrufende Bildschirm liefert immer eine leere Liste — sichtbar
    // richtige Schlagwörter gibt es nur über details.tags.
    expect(source).toContain('setTagsText(details.tags.join(", "))');
  });
});
