import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const read = (rel: string) => readFileSync(join(mobileRoot, rel), "utf-8").replace(/\r\n/g, "\n");

// #397: Der eigentliche Fix ist die REIHENFOLGE in den Bildschirmen — erst die
// laufenden reviewCard-Anfragen abwarten, dann earnLp rufen. Die Unit-Tests zu
// learn-session-lp.ts prüfen nur das Hilfsmodul: sie bleiben grün, selbst wenn
// alle drei Bildschirme wieder in die alte Wettlaufversion zurückfallen.
//
// Die Bildschirme unter app/ haben in dieser Suite keine Laufzeit-Umgebung
// (vitest läuft mit environment "node", react-native wird nicht transformiert),
// also wird der Quelltext geprüft — dieselbe Konvention wie
// occlusion-pro-hint.test.ts und deck-view-load-error.test.ts. Das ist bewusst
// eine Struktur- und keine Verhaltensprüfung.

const SCREENS: { name: string; rel: string }[] = [
  { name: "learn", rel: "app/(tabs)/learn.tsx" },
  { name: "practice", rel: "app/practice.tsx" },
  { name: "cloze", rel: "app/cloze.tsx" },
];

for (const { name, rel } of SCREENS) {
  describe(`mobile ${name} – earnLp erst, wenn die Reviews durch sind`, () => {
    const source = read(rel);

    it("hängt jede reviewCard-Anfrage in die Warteliste", () => {
      // Ohne das Sammeln kann der Bildschirm gar nicht wissen, worauf er wartet.
      expect(source).toContain("pendingReviewsRef.current.push(reviewPromise);");
    });

    it("wartet die offenen Reviews ab, BEVOR earnLp läuft", () => {
      const waited = source.indexOf("await Promise.allSettled(pendingReviews);");
      const earned = source.indexOf('earnLp("session")');
      expect(waited).toBeGreaterThan(-1);
      expect(earned).toBeGreaterThan(-1);
      expect(waited).toBeLessThan(earned);
    });

    it("wiederholt earnLp, solange der Server noch nichts gutgeschrieben hat", () => {
      expect(source).toContain("for (let attempt = 0; attempt < maxAttempts; attempt += 1)");
      expect(source).toContain("isSessionEarnFinalized(result, reviewedCount)");
    });
  });
}

describe("mobile cloze – Folgerunden werden weiter abgerechnet", () => {
  const source = read("app/cloze.tsx");

  const from = source.indexOf("const startRound = async (");
  const to = source.indexOf("const handleCheck =");
  const startRound = from > -1 && to > from ? source.slice(from, to) : "";

  it("rechnet schon am Rundenende ab — deshalb ist das Scharfmachen nötig", () => {
    // Nur weil hier mitten im Bildschirm abgerechnet wird (state.finalized =
    // true), braucht der Lückentext überhaupt ein Zurücksetzen. learn und
    // practice rechnen ausschliesslich beim Verlassen ab.
    expect(source).toContain("void awardSession(reviewedCount);");
  });

  it("macht die Abrechnung beim Rundenstart wieder scharf", () => {
    expect(startRound).not.toBe("");
    expect(startRound).toContain("awardStateRef.current.finalized = false;");
    expect(startRound).toContain("pendingReviewsRef.current = [];");
    expect(startRound).toContain("sessionReviewsRef.current = 0;");
  });

  it("wartet die vorige Gutschrift ab, BEVOR es wieder scharf macht", () => {
    // Andersherum wäre es wirkungslos: der noch laufende Lauf setzt finalized
    // gleich wieder auf true, nachdem startRound es zurückgesetzt hat.
    expect(startRound).not.toBe("");
    const awaited = startRound.indexOf("await awardSession(");
    const rearmed = startRound.indexOf("awardStateRef.current.finalized = false;");
    expect(awaited).toBeGreaterThan(-1);
    expect(rearmed).toBeGreaterThan(-1);
    expect(awaited).toBeLessThan(rearmed);
  });

  it("nutzt startRound an allen vier Startknöpfen", () => {
    // Setup „“, „“, „“.
    // Vierter Knopf seit dem Fortsetzen-Angebot: "Weitermachen" nimmt die
    // unterbrochene Runde an ihrer Position auf. Gezaehlt wird nur, was ueber
    // startRound geht — ein Startknopf, der die Runde direkt setzt, wuerde die
    // Abrechnung nicht scharf machen und die Folgerunde ohne LP laufen lassen.
    expect(source.match(/void startRound\(/g)).toHaveLength(4);
  });
});

describe("mobile learn/practice – rechnen nur beim Verlassen ab", () => {
  // Hält die Analyse zu #397 fest: diese beiden Bildschirme setzen finalized
  // nie, solange sie sichtbar sind — der Aufruf steht allein im Blur-Cleanup,
  // und beim nächsten Fokus wird der Zustand ohnehin frisch gesetzt. Ihre
  // Wiederholungsknöpfe („“ / „“) können deshalb nicht
  // blockieren. Kommt hier je ein zweiter awardSession-Aufruf dazu, braucht der
  // Bildschirm dasselbe Scharfmachen wie cloze.startRound — dann schlägt das
  // hier fehl und die Frage steht wieder auf dem Tisch.
  for (const rel of ["app/(tabs)/learn.tsx", "app/practice.tsx"]) {
    it(`${rel}: genau ein awardSession-Aufruf, und der steht im Blur-Cleanup`, () => {
      const source = read(rel);
      expect(source.match(/awardSession\(/g)).toHaveLength(1);
      expect(source).toContain("await awardSession(reviewedCount);");
      expect(source).toContain("awardStateRef.current = { finalized: false, inFlight: null };");
    });
  }
});
