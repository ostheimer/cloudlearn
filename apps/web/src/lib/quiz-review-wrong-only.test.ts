import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Bug #210: Ein Glückstreffer im Multiple-Choice darf die FSRS-Planung nicht
// vorspulen. Diese Regel gilt unverändert — WO sie durchgesetzt wird, hat sich
// mit der Entkopplung (Schritt 5/8) aber verschoben:
//
//   vorher: der Client schickte bei einem Treffer GAR NICHTS
//           (`correct ? Promise.resolve() : reviewCard(..., "again")`)
//   jetzt:  der Client schickt immer, mit mode:"quiz" — und der SERVER
//           entscheidet (movesTheSchedule in reviewService): Treffer aus einem
//           Rate-Modus bewegen die Planung nicht, Fehler schon.
//
// Der alte Weg hatte eine Nebenwirkung, die der Nutzerin aufgefallen ist:
// Lernpunkte entstehen aus genau diesen Zeilen. Wer alles richtig hatte, bekam
// null Punkte — „warum bekommt man nur Punkte, wenn man was falsch hat?"
//
// Geprüft wird der Seitenquelltext, dieselbe Naht wie in
// learn-session-lp-pages.test.ts (dieses Paket hat kein jsdom/Render-Setup).

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const quizPage = readFileSync(
  join(webRoot, "app/dashboard/deck/[id]/quiz/page.tsx"),
  "utf-8",
);

describe("quiz page FSRS review gating (#210)", () => {
  it("labels every review as quiz — that is what stops guesses from scheduling", () => {
    // Ohne mode:"quiz" käme die Antwort als Karteikarte an und der Server würde
    // sie einplanen — genau der Fehler aus #210, nur eine Ebene tiefer.
    expect(quizPage).toContain('mode: "quiz"');
  });

  it("sends a review for BOTH outcomes now", () => {
    // Treffer und Fehler erzeugen je eine Zeile. Ohne die Zeile bei einem
    // Treffer gäbe es dafür keine Lernpunkte.
    expect(quizPage).toContain('correct ? "good" : "again"');
  });

  it("no longer swallows correct answers", () => {
    // Der alte Verzicht (Promise.resolve statt Aufruf) ist der eigentliche
    // Regressionsschutz: kehrt er zurück, sind die Lernpunkte wieder weg.
    expect(quizPage).not.toContain("? Promise.resolve()");
  });

  it("still queues the review promise so session LP earning is unchanged", () => {
    // pendingReviewsRef.current.length feeds getSessionReviewedCount → earnLp.
    expect(quizPage).toContain("pendingReviewsRef.current.push(reviewPromise)");
  });
});
