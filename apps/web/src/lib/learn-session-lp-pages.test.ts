import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const webRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");

const lpModePages = [
  {
    // Kein Screen, sondern der geteilte Karteikarten-Ablauf hinter der Deck- UND
    // der Ordner-Lernseite — die LP-Logik hängt hier für beide.
    name: "learn-session (geteilt)",
    path: "src/components/app/learn-session.tsx",
    // total - startIndex: Beim Weitermachen zählen nur die Karten ab der
    // Einstiegskarte — die übersprungenen wurden letztes Mal abgerechnet.
    restartGuard:
      "async function startRound(next: Card[]) {\n    await awardSession(total - startIndex);",
    awardCalls: ["void awardSession(total - startIndex)", "await awardSession(reviewedCount)"],
  },
  {
    name: "quiz",
    path: "app/dashboard/deck/[id]/quiz/page.tsx",
    restartGuard:
      "const startQuizWith = useCallback(async (cardsForRound: Card[]) => {\n    await awardSession(total);",
    awardCalls: ["void awardSession(reviewedCount)", "await awardSession(reviewedCount)"],
  },
  {
    name: "cloze",
    path: "app/dashboard/deck/[id]/cloze/page.tsx",
    // startAt setzt eine unterbrochene Runde fort (Weitermachen) — die
    // Abrechnungs-Reihenfolge davor bleibt unverändert.
    restartGuard:
      "const startRound = useCallback(async (cards: Card[], startAt = 0) => {\n    await awardSession(round.length);",
    awardCalls: ["void awardSession(reviewedCount)", "await awardSession(reviewedCount)"],
  },
  // Der Test-Modus steht hier BEWUSST nicht mehr: Eine Prüfung misst, sie
  // lehrt nicht — sie rechnet seit der Entkopplung (Schritt 7) keine
  // Lernpunkte mehr ab. Ein eigener Test unten hält das fest, damit die
  // LP-Verdrahtung nicht versehentlich zurückkehrt.
  {
    name: "occlusion",
    path: "app/dashboard/deck/[id]/occlusion/page.tsx",
    restartGuard: "async function restartWrong() {\n    const subset = wrong;\n    await awardSession(total);",
    awardCalls: ["void awardSession(total)", "await awardSession(reviewedCount)"],
  },
];

describe("web session LP mode pages", () => {
  it.each(lpModePages)(
    "waits for persisted reviews before awarding LP in $name mode",
    ({ path, restartGuard, awardCalls }) => {
      // \r\n normalisieren, damit der Test auch auf Windows-Checkouts (CRLF) läuft
      const source = readFileSync(join(webRoot, path), "utf-8").replace(/\r\n/g, "\n");

      expect(source).toContain("beginSessionAward");
      expect(source).toContain("getSessionReviewedCount");
      expect(source).toContain("isSessionEarnFinalized");
      expect(source).toContain("pendingReviewsRef.current.push(reviewPromise)");
      expect(source).toContain("await Promise.allSettled(pendingReviews)");
      for (const call of awardCalls) {
        expect(source).toContain(call);
      }
      expect(source).toContain(restartGuard);
      expect(source).not.toContain("awardedRef");
    },
  );
});

describe("web test mode measures instead of rewarding", () => {
  const source = readFileSync(
    join(webRoot, "app/dashboard/deck/[id]/test/page.tsx"),
    "utf-8",
  ).replace(/\r\n/g, "\n");

  it("does not award LP at all", () => {
    // „Beim Test sollte man keine Lernpunkte bekommen oder etwas bei Tagesziel,
    // da man ja im Prinzip nicht gelernt hat." Das Tagesziel kommt automatisch
    // mit: es zählt dieselben Zeilen, die der Server für LP überspringt.
    expect(source).not.toContain("earnLp");
    expect(source).not.toContain("awardSession");
    expect(source).not.toContain("beginSessionAward");
  });

  it("labels every review as test — including the self-correction", () => {
    // Ohne mode:"test" käme die eine Nachbewertung aus „Trotzdem als richtig
    // zählen" als Karteikarte an und wäre die einzige Regung der ganzen
    // Prüfung, die den Lernplan bewegt.
    const reviewCalls = source.match(/reviewCard\([^;]*?\)/gs) ?? [];
    expect(reviewCalls.length).toBeGreaterThan(0);
    reviewCalls.forEach((call) => {
      expect(call).toContain('mode: "test"');
    });
  });

  it("still sends reviews — streak, statistics and wrong cards depend on them", () => {
    // Der Eintrag entsteht weiter; nur die Neuplanung überspringt der Server
    // (und auch die nur bei Treffern — Fehler holen die Karte zurück).
    expect(source).toContain("reviewCard(");
  });
});
