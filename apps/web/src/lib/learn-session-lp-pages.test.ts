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
    restartGuard: "async function startRound(next: Card[]) {\n    await awardSession(total);",
    awardCalls: ["void awardSession(total)", "await awardSession(reviewedCount)"],
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
    restartGuard:
      "const startRound = useCallback(async (cards: Card[]) => {\n    await awardSession(round.length);",
    awardCalls: ["void awardSession(reviewedCount)", "await awardSession(reviewedCount)"],
  },
  {
    name: "test",
    path: "app/dashboard/deck/[id]/test/page.tsx",
    restartGuard:
      "const buildAndStart = useCallback(\n    async (sourceCards: Card[]) => {\n      await awardSession(questions.length);",
    awardCalls: ["void awardSession(reviewedCount)", "await awardSession(questions.length)"],
  },
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
