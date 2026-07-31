import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Rücksprung nach dem Anmelden (#708).
 *
 * Wer über einen geteilten Deck-Link kommt und noch kein Konto hat, soll nach
 * dem Anmelden WIEDER BEIM DECK landen — nicht auf der Startseite. Dafür trägt
 * die Anmeldung `?next=`.
 *
 * Der Wert darf nur ein eigener Pfad sein. Sonst wäre die Anmeldung eine offene
 * Weiterleitung: Ein Link auf unsere echte Anmeldeseite könnte nach dem Login
 * auf eine fremde Seite führen, die wie clearn aussieht und dort noch einmal
 * nach dem Passwort fragt.
 *
 * Die Regel steht in auth-form.tsx; hier wird sie einzeln nachgestellt und
 * gegen den Quelltext gehalten, damit sie nicht unbemerkt aufgeweicht wird.
 */
const SAFE_PATH = /^\/(?!\/)/;

function loginTarget(next: string | null): string {
  return next && SAFE_PATH.test(next) ? next : "/dashboard/home";
}

describe("Rücksprung nach dem Anmelden (#708)", () => {
  it("springt zum eigenen Pfad zurück", () => {
    expect(loginTarget("/deck/abc-123")).toBe("/deck/abc-123");
    expect(loginTarget("/dashboard/archive")).toBe("/dashboard/archive");
  });

  it("weist fremde Ziele ab", () => {
    // Schema-relativ: „//example.com" ist im Browser eine ANDERE Seite.
    expect(loginTarget("//example.com")).toBe("/dashboard/home");
    expect(loginTarget("https://example.com")).toBe("/dashboard/home");
    expect(loginTarget("http://example.com")).toBe("/dashboard/home");
    // Kein führender Schrägstrich: relativ, aber nicht als Ziel gedacht.
    expect(loginTarget("dashboard/home")).toBe("/dashboard/home");
    expect(loginTarget("javascript:alert(1)")).toBe("/dashboard/home");
  });

  it("nimmt ohne Angabe die Startseite", () => {
    expect(loginTarget(null)).toBe("/dashboard/home");
    expect(loginTarget("")).toBe("/dashboard/home");
  });

  it("benutzt im Anmelde-Formular dieselbe Regel", () => {
    const source = readFileSync(
      resolve(__dirname, "../components/app/auth-form.tsx"),
      "utf8"
    );
    // Weder die Prüfung noch das Ziel dürfen still verschwinden.
    expect(source).toContain('searchParams.get("next")');
    expect(source).toContain("/^\\/(?!\\/)/.test(nextParam)");
    expect(source).toContain('"/dashboard/home"');
  });
});
