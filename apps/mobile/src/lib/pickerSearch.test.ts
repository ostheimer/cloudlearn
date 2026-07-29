import { describe, expect, it } from "vitest";
import { PICKER_SEARCH_THRESHOLD, filterByTitle } from "./pickerSearch";

// Suche in den Auswahl-Fenstern (#612): Groß-/Kleinschreibung und Randleerraum
// dürfen keine Rolle spielen, eine leere Suche zeigt alles.
describe("filterByTitle — Picker-Suche", () => {
  const items = [
    { title: "Biologie" },
    { title: "Chemie Säuren" },
    { title: "Englisch Vokabeln" },
  ];

  it("zeigt bei leerer Suche alles", () => {
    expect(filterByTitle(items, "")).toEqual(items);
    expect(filterByTitle(items, "   ")).toEqual(items);
  });

  it("findet unabhängig von Groß-/Kleinschreibung, auch mitten im Titel", () => {
    expect(filterByTitle(items, "säuren")).toEqual([{ title: "Chemie Säuren" }]);
    expect(filterByTitle(items, "BIO")).toEqual([{ title: "Biologie" }]);
  });

  it("ignoriert Leerraum am Rand der Eingabe", () => {
    expect(filterByTitle(items, "  vokabeln ")).toEqual([{ title: "Englisch Vokabeln" }]);
  });

  it("liefert leer, wenn nichts passt", () => {
    expect(filterByTitle(items, "Latein")).toEqual([]);
  });

  it("hält die Schwelle fürs Einblenden des Suchfelds fest", () => {
    // Web (AddToFolderModal/AddDecksModal) nutzt denselben Wert als lokale
    // Konstante — wer hier ändert, muss dort mitziehen.
    expect(PICKER_SEARCH_THRESHOLD).toBe(6);
  });
});
