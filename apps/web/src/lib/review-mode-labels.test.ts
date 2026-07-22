import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Jede Wiederholung trägt ein Etikett, aus welchem Modus sie stammt. Daran
 * entscheidet der Server, wer sie mitzählt: Prüfungen geben keine Lernpunkte,
 * geratene Treffer bewegen den Lernplan nicht, Quiz und Zuordnen zahlen je
 * Karte nur einmal am Tag.
 *
 * Die App hatte diesen Test schon (mobile/src/lib/review-mode-labels.test.ts),
 * das Web nicht — und prompt fehlte das Etikett dort in Lückentext und
 * Bild-Abdecken. Ohne Wirkung heute (beide zählen wie Karteikarten), aber die
 * Daten sagten dauerhaft „Karteikarte", und rückwirkend lässt sich das nie
 * mehr richtigstellen.
 *
 * Geprüft wird der Quelltext: Diese Seiten haben in dieser Suite keine
 * Laufzeit-Umgebung — dieselbe Konvention wie learn-session-lp-pages.test.ts.
 */

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf-8").replace(/\r\n/g, "\n");

const MODI: { name: string; rel: string; mode: string }[] = [
  { name: "Karteikarten (Deck + Ordner)", rel: "src/components/app/learn-session.tsx", mode: "flashcard" },
  { name: "Lückentext", rel: "app/dashboard/deck/[id]/cloze/page.tsx", mode: "cloze" },
  { name: "Bild-Abdecken", rel: "app/dashboard/deck/[id]/occlusion/page.tsx", mode: "occlusion" },
  { name: "Multiple Choice", rel: "app/dashboard/deck/[id]/quiz/page.tsx", mode: "quiz" },
  { name: "Zuordnen", rel: "app/dashboard/deck/[id]/match/page.tsx", mode: "match" },
  { name: "Prüfung", rel: "app/dashboard/deck/[id]/test/page.tsx", mode: "test" },
];

describe("Web — jeder Lernmodus meldet sein eigenes Etikett", () => {
  it.each(MODI)("$name meldet mode \"$mode\"", ({ rel, mode }) => {
    expect(read(rel)).toContain(`mode: "${mode}"`);
  });

  it.each(MODI)("$name schickt kein fremdes Etikett", ({ rel, mode }) => {
    const src = read(rel);
    const andere = MODI.map((m) => m.mode).filter((m) => m !== mode);
    for (const fremd of andere) {
      expect(src).not.toContain(`mode: "${fremd}"`);
    }
  });

  it.each(MODI)("$name setzt es an JEDEM reviewCard-Aufruf", ({ rel, mode }) => {
    // Eine vergessene Stelle reicht: In der Prüfung wäre die Nachbewertung
    // („Trotzdem als richtig zählen") sonst als Karteikarte angekommen und
    // hätte als einzige Regung der ganzen Prüfung den Lernplan bewegt.
    const src = read(rel);
    const aufrufe = src.match(/reviewCard\([\s\S]*?\)\s*\.catch/g) ?? [];
    expect(aufrufe.length).toBeGreaterThan(0);
    for (const aufruf of aufrufe) {
      expect(aufruf).toContain(`mode: "${mode}"`);
    }
  });
});
