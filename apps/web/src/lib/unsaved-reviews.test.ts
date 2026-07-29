import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { ApiError } from "./api";
import { isCardGone, persistedReviewCount, unsavedReviewsNotice } from "./unsaved-reviews";

/**
 * #605: Wird eine Karte auf Gerät A gelöscht, während Gerät B sie noch in
 * einer offenen Runde hat, lehnt der Server die Bewertung mit 404 ab. Vorher
 * verschluckten alle fünf Web-Lernmodi diesen Fehler — „Runde geschafft",
 * obwohl nichts verbucht war. Hier stehen beide Schichten der Absicherung:
 * die Bausteine selbst und (wie beim App-Vorbild #460) die REGEL, dass kein
 * Modus die Ablehnung wieder still wegwerfen darf.
 */

describe("#605 — isCardGone erkennt endgültig verlorene Bewertungen", () => {
  it("404 vom Server heißt: Karte oder Deck wurde inzwischen gelöscht", () => {
    expect(isCardGone(new ApiError("Card not found", 404, "CARD_NOT_FOUND"))).toBe(true);
    expect(isCardGone(new ApiError("Deck not found", 404, "DECK_NOT_FOUND"))).toBe(true);
    // Auch ohne code-Feld zählt der Status — ältere/fremde Antworten.
    expect(isCardGone(new ApiError("Not found", 404))).toBe(true);
  });

  it("alles andere bleibt best-effort (kein falscher Alarm)", () => {
    expect(isCardGone(new ApiError("Server down", 500))).toBe(false);
    expect(isCardGone(new ApiError("Too many requests", 429))).toBe(false);
    expect(isCardGone(new ApiError("Unauthorized", 401, "UNAUTHORIZED"))).toBe(false);
    // Netzfehler sind keine ApiError — der Server hat gar nicht geantwortet.
    expect(isCardGone(new Error("Failed to fetch"))).toBe(false);
    expect(isCardGone(undefined)).toBe(false);
  });
});

describe("#605 — die ehrliche Ergebnis-Zeile (Laras Wortlaut, 29.07.)", () => {
  it("verschwindet ganz, wenn nichts verloren ging", () => {
    expect(unsavedReviewsNotice(0)).toBeNull();
    expect(unsavedReviewsNotice(-1)).toBeNull();
  });

  it("Einzahl und Mehrzahl exakt im abgestimmten Wortlaut", () => {
    expect(unsavedReviewsNotice(1)).toBe(
      "1 Bewertung konnte nicht gespeichert werden — die Karte wurde inzwischen gelöscht."
    );
    expect(unsavedReviewsNotice(3)).toBe(
      "3 Bewertungen konnten nicht gespeichert werden — die Karten wurden inzwischen gelöscht."
    );
  });
});

describe("#605 — Lernpunkte nur für wirklich Gespeichertes", () => {
  it("zieht die endgültig abgelehnten Bewertungen ab", () => {
    expect(persistedReviewCount(30, 3)).toBe(27);
    expect(persistedReviewCount(10, 0)).toBe(10);
  });

  it("wird nie negativ — lieber nichts beanspruchen als Unsinn", () => {
    expect(persistedReviewCount(2, 5)).toBe(0);
  });
});

// ─── Die Regel: Kein Lernmodus darf die Ablehnung wieder verschlucken ───────

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

/** Die fünf Oberflächen, deren Verschlucken #605 gemeldet hat. Der
 * Prüfungs-Modus bleibt bewusst draußen: Er vergibt keine LP, und seine
 * Note zählt der Server ohnehin gegen die echten, nicht gelöschten Karten
 * (testAttemptService). */
const reviewSurfaces = [
  "src/components/app/learn-session.tsx",
  "app/dashboard/deck/[id]/cloze/page.tsx",
  "app/dashboard/deck/[id]/quiz/page.tsx",
  "app/dashboard/deck/[id]/match/page.tsx",
  "app/dashboard/deck/[id]/occlusion/page.tsx",
];

describe("#605 — jede Oberfläche zählt und zeigt verlorene Bewertungen", () => {
  it.each(reviewSurfaces)("%s wirft 404-Ablehnungen nicht mehr still weg", (rel) => {
    const source = readFileSync(join(webRoot, rel), "utf-8").replace(/\r\n/g, "\n");
    // Genau das Muster, das #605 verursacht hat.
    expect(source).not.toMatch(
      /reviewCard\([^)]*\)\s*\.catch\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/s
    );
    expect(source).toContain("isCardGone");
    // Die Zeile erscheint auch wirklich im Ergebnis, nicht nur im Zähler.
    expect(source).toContain("unsavedReviewsNotice(unsavedCount)");
    expect(source).toContain('className="study-unsaved"');
    // Und die LP-Abrechnung beansprucht nur Gespeichertes.
    expect(source).toContain("persistedReviewCount(");
  });
});
