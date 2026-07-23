import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Zwilling zu apps/web/src/lib/test-attempt-on-submit.test.ts. Eine ABGEGEBENE
 * Prüfung wird als eine Zeile protokolliert, ein ABBRUCH nicht — sonst wäre
 * „12 von 30" bei Frage 12 eine erlogene 60-%-Note über 18 nie beantwortete
 * Fragen. Der Schutz sitzt im `scope === "all"`-Guard; wird er entfernt,
 * speichert jeder Abbruch eine falsche Note.
 *
 * Quelltext-Prüfung wie review-mode-labels.test.ts.
 */
const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const src = readFileSync(join(mobileRoot, "app/test.tsx"), "utf-8").replace(/\r\n/g, "\n");

describe("App — Prüfung als Einheit nur bei voller Abgabe", () => {
  it("protokolliert an genau zwei Stellen: Abgabe und Nachbewertung", () => {
    // Genau zwei Aufrufe: volle Abgabe (finish) und Note nachziehen bei
    // „Trotzdem als richtig zählen". Ein dritter, ungeschützter bräche die Zahl.
    const calls = src.match(/recordTestAttempt\(/g) ?? [];
    expect(calls.length).toBe(2);
  });

  it("die Abgabe schreibt nur hinter dem scope === \"all\"-Guard", () => {
    expect(src).toMatch(/scope === "all"[\s\S]{0,400}recordTestAttempt\(/);
  });

  it("die Nachbewertung schreibt nur für eine bereits gespeicherte Runde", () => {
    expect(src).toMatch(/attemptRecordedRef\.current[\s\S]{0,400}recordTestAttempt\(/);
  });
});
