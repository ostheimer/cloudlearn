import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * #460: Multiple Choice, Zuordnen, Bild-Abdecken und die Prüfung warfen
 * Antworten bei Netzproblemen still weg — sie riefen
 * `reviewCard(...).catch(() => {})` ohne Warteschlange, während Karteikarten,
 * Üben und Lückentext sie sauber aufhoben.
 *
 * Ursache war nicht Nachlässigkeit an einer Stelle, sondern dass JEDER Modus
 * das Senden selbst baute — vier von sieben bauten es falsch.
 *
 * Geprüft wird deshalb die REGEL, nicht der Einzelfall: Wer eine Wiederholung
 * schickt, muss ihren Fehlschlag auffangen. Erlaubt sind genau zwei Wege:
 * `sendReview` (der gemeinsame Helfer) oder ein eigener Aufruf MIT
 * `enqueueOfflineReview`. Ein nacktes `.catch(() => {})` ist verboten.
 */

const appDir = join(dirname(fileURLToPath(import.meta.url)), "../../../app");

/** Alle .tsx im app-Ordner, auch in Unterordnern wie (tabs)/ und deck/. */
function alleBildschirme(dir: string, prefix = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? alleBildschirme(join(dir, e.name), `${prefix}${e.name}/`)
      : e.name.endsWith(".tsx")
        ? [`${prefix}${e.name}`]
        : []
  );
}

const bildschirmeMitReview = alleBildschirme(appDir).filter((rel) =>
  /reviewCard\(|sendReview\(/.test(readFileSync(join(appDir, rel), "utf-8"))
);

describe("#460 — jede gesendete Antwort hat ein Auffangnetz", () => {
  it("es gibt überhaupt Bildschirme, die Wiederholungen schicken", () => {
    // Schutz gegen einen stillen Fehlschlag der Suche: Findet sie nichts,
    // wären alle folgenden Prüfungen leer und damit wertlos.
    expect(bildschirmeMitReview.length).toBeGreaterThan(3);
  });

  it.each(bildschirmeMitReview)("%s fängt Fehlschläge auf", (rel) => {
    const src = readFileSync(join(appDir, rel), "utf-8");
    // Auf den IMPORT prüfen, nicht auf den Namen: (tabs)/learn.tsx hat eine
    // eigene lokale Funktion namens sendReview (ältere Fassung mit Puffer und
    // Fehleranzeige). Sie erfüllt die Regel über enqueueOfflineReview — würde
    // aber bei einer Namensprüfung fälschlich als Helfer-Nutzung durchgehen.
    const nutztHelfer = /from "[^"]*sync\/sendReview"/.test(src);
    const eigeneWarteschlange = src.includes("enqueueOfflineReview");
    expect(nutztHelfer || eigeneWarteschlange).toBe(true);
  });

  it.each(bildschirmeMitReview)("%s verschluckt Sendefehler nicht", (rel) => {
    const src = readFileSync(join(appDir, rel), "utf-8");
    // Genau das Muster, das #460 verursacht hat.
    expect(src).not.toMatch(/reviewCard\([^)]*\)\s*\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/s);
  });
});

describe("#460 — der Helfer wiederholt das Richtige", () => {
  const helfer = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "sendReview.ts"), "utf-8");

  it("hebt Netz- und Serverfehler auf", () => {
    expect(helfer).toContain("if (!isApiError(error)) return true");
    expect(helfer).toContain("error.status >= 500");
  });

  it("hebt auch 429 auf — die eigene Bremse darf kein Lernen kosten", () => {
    // 429 ist ein 4xx, gehört aber wiederholt: Seit #358 bremst der Server
    // Wiederholungen, und ein Nachzügler-Stapel kann die Grenze kurz reißen.
    // „Zu viele Anfragen" heißt später nochmal, nicht falsch.
    expect(helfer).toContain("error.status === 429");
  });
});
