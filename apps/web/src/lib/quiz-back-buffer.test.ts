import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel: string) => readFileSync(join(webRoot, rel), "utf-8").replace(/\r\n/g, "\n");

const quiz = read("app/dashboard/deck/[id]/quiz/page.tsx");

/**
 * Zurück-Pfeil im Quiz (#571 Teil B).
 *
 * Die gefährliche Stelle ist nicht der Knopf, sondern die Buchhaltung: Vor
 * diesem Umbau ging jede Antwort SOFORT als Wiederholung raus. Ein Zurück
 * hätte die Frage danach ein zweites Mal gemeldet — dieselbe Karte zweimal in
 * der Statistik, zweimal Lernpunkte, Planung verschoben. Genau deshalb liegt
 * zwischen Antwort und Versand jetzt derselbe Ein-Schritt-Puffer wie in der
 * Karteikarten-Runde (#582).
 *
 * Der Test prüft am Quelltext, dass die vier Stellen zusammenpassen, die das
 * garantieren. Ein Rendertest wäre hier schwächer: Er würde den Knopf drücken,
 * aber nicht sichtbar machen, ob am Rundenende geleert wird.
 */
describe("Quiz-Zurück: keine doppelt gezählte Antwort (#571)", () => {
  it("schickt die Bewertung nicht mehr sofort, sondern über den Puffer", () => {
    expect(quiz).toContain('import { createReviewSendBuffer } from "@/lib/review-send-buffer";');
    expect(quiz).toContain("const reviewBufferRef = useRef(createReviewSendBuffer());");
    // In pick(): erst puffern, dann die VORIGE Bewertung senden.
    expect(quiz).toContain("const previous = reviewBufferRef.current.rate({");
    expect(quiz).toContain("if (previous) sendReview(previous.cardId, previous.rating);");
  });

  it("verwirft beim Zurückgehen die noch nicht gesendete Bewertung", () => {
    expect(quiz).toContain("reviewBufferRef.current.back();");
    // Und nimmt die Antwort auch aus der Auswertung heraus, sonst zählt eine
    // zurückgenommene Frage beim Beenden weiter als beantwortet.
    expect(quiz).toContain("next[index - 1] = undefined;");
  });

  it("leert den Puffer an beiden Ausgängen — Rundenende und Beenden", () => {
    // Die letzte Antwort hat kein „danach"; ohne diese zwei Stellen ginge sie
    // verloren (Rundenende) oder käme nie an (Beenden).
    const atEnd = quiz.slice(quiz.indexOf("function next()"), quiz.indexOf("function back()"));
    expect(atEnd).toContain("const last = reviewBufferRef.current.flush();");
    expect(atEnd).toContain("if (last) sendReview(last.cardId, last.rating);");

    const onQuit = quiz.slice(quiz.indexOf("async function quit()"));
    expect(onQuit.slice(0, 400)).toContain("const last = reviewBufferRef.current.flush();");
  });

  it("sperrt den Zurück-Pfeil bei der ersten und bei einer beantworteten Frage", () => {
    // Nach dem Klick steht die Auflösung schon da — ein Rücksprung wäre ein
    // Weg, eine falsche Antwort verschwinden zu lassen.
    expect(quiz).toContain("if (index === 0 || picked !== null) return;");
    expect(quiz).toContain("disabled={index === 0 || picked !== null}");
  });
});
