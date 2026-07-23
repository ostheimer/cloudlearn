import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Eine ABGEGEBENE Prüfung wird als eine Zeile protokolliert (recordTestAttempt),
 * ein ABBRUCH nicht. „12 von 30" bei Frage 12 wäre eine erlogene 60-%-Note über
 * 18 nie beantwortete Fragen — deshalb sitzt der Aufruf hinter einem
 * `scope === "all"`-Guard. Wird der entfernt oder der Aufruf in den gemeinsamen
 * Pfad gezogen, speichert jeder Abbruch eine falsche Note. Genau das fängt
 * dieser Test.
 *
 * Quelltext-Prüfung: Diese Seite hat in dieser Suite keine Laufzeit-Umgebung —
 * dieselbe Konvention wie review-mode-labels.test.ts.
 */
const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(
  join(webRoot, "app/dashboard/deck/[id]/test/page.tsx"),
  "utf-8"
).replace(/\r\n/g, "\n");

describe("Web — Prüfung als Einheit nur bei voller Abgabe", () => {
  it("protokolliert die Prüfung genau an einer Stelle", () => {
    // Der Import steht als `recordTestAttempt,` ohne Klammer und zählt nicht mit.
    const calls = src.match(/recordTestAttempt\(/g) ?? [];
    expect(calls.length).toBe(1);
  });

  it("ruft recordTestAttempt nur hinter dem scope === \"all\"-Guard", () => {
    expect(src).toMatch(/scope === "all"[\s\S]{0,400}recordTestAttempt\(/);
  });
});
