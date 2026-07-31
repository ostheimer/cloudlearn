/**
 * Meilenstein-Boni, die der Server SELBST einlöst (#637).
 *
 * Vorher zahlte der Server nur auf Zuruf, und das Web rief nie an — kein
 * Web-Konto hat je einen der beworbenen Boni bekommen, `first_deck` gar keines.
 * Diese Tests halten fest, was die Automatik leisten muss:
 *
 *  - Ein Bonus wird gemeldet, wenn er WIRKLICH geflossen ist, und sonst nie.
 *  - Ein zweiter Aufruf zahlt kein zweites Mal (die Kernbedingung dafür, dass
 *    man diese Aufrufe überhaupt automatisch auslösen darf).
 *  - Eine klemmende Gutschrift reißt nie den Aufruf mit, der sie ausgelöst hat.
 *  - Streak-Stufen zünden AB 7/30/100 (>=), nicht davor — und holen eine Stufe
 *    auch nach, wenn ihr exakter Tag übersprungen wurde (App zu, kein Netz),
 *    weil die Vergabe je Stufe ohnehin nur einmal zieht (#702).
 *
 * Statt die RPC-Antwort je Fall zu stellen, ahmt `makeLedgerDb` das echte
 * Verhalten von `claim_milestone_lp` nach (Sperrzeile + Gutschrift in EINER
 * Transaktion): so prüft der Doppel-Aufruf-Test wirklich den Kontostand und
 * nicht nur eine gemockte Rückgabe.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { LP_EARN_RULES } from "../lib/featureGates";
import { awardFirstDeckMilestone, awardMilestone, awardSessionMilestones } from "@/services/lpService";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { getStreakInfo } from "@/lib/db";

vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/db", () => ({ getStreakInfo: vi.fn() }));
vi.mock("@/lib/observability", () => ({ logError: vi.fn() }));

const USER = "11111111-1111-4111-8111-111111111111";

/**
 * Buchhaltung wie in der Migration 20260708150000_atomic_claim_milestone.sql:
 * Die Sperrzeile (user, reward_key) entsteht nur beim ERSTEN Mal, und nur dann
 * fließen Punkte. Jeder weitere Aufruf meldet `already_claimed` und lässt den
 * Kontostand unangetastet.
 */
function makeLedgerDb(startBalance = 0) {
  const claimed = new Set<string>();
  let balance = startBalance;
  const ledger: Array<{ reason: string; amount: number }> = [];

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    if (fn !== "claim_milestone_lp") throw new Error(`unerwartete RPC: ${fn}`);
    const key = `${args.p_user}:${args.p_reward_key}`;
    const amount = args.p_amount as number;

    if (claimed.has(key)) {
      return { data: [{ granted: 0, already_claimed: true, new_balance: balance }], error: null };
    }
    claimed.add(key);
    balance += amount;
    ledger.push({ reason: `milestone_${args.p_reward_key}`, amount });
    return { data: [{ granted: amount, already_claimed: false, new_balance: balance }], error: null };
  });

  return { rpc, ledger, balance: () => balance, calls: () => rpc.mock.calls.length };
}

function useDb(db: { rpc: unknown }) {
  vi.mocked(createSupabaseAdminClient).mockReturnValue(db as never);
}

function streak(currentStreak: number) {
  vi.mocked(getStreakInfo).mockResolvedValue({
    currentStreak,
    longestStreak: currentStreak,
    lastReviewDate: null,
    dailyGoal: 30,
    streakFreezes: 0,
    repairAvailable: false,
    repairBrokenStreak: 0,
    repairCost: 0,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  streak(0);
});

describe("awardMilestone", () => {
  it("meldet den Bonus mit den Punkten aus den Regeln, wenn er frisch fließt", async () => {
    const db = makeLedgerDb();
    useDb(db);

    await expect(awardMilestone(USER, "first_deck")).resolves.toEqual({
      key: "first_deck",
      lpGranted: LP_EARN_RULES.firstDeck,
    });
    expect(db.balance()).toBe(LP_EARN_RULES.firstDeck);
  });

  it("meldet NICHTS, wenn der Bonus schon eingelöst war", async () => {
    const db = makeLedgerDb();
    useDb(db);

    await awardMilestone(USER, "first_deck");
    // Zweiter Aufruf: kein Hinweis mehr — sonst erschiene „Erstes Deck" bei
    // jedem weiteren Deck erneut.
    await expect(awardMilestone(USER, "first_deck")).resolves.toBeNull();
  });

  it("zahlt bei Doppel-Aufrufen nur EINMAL — auch bei vielen Anläufen", async () => {
    const db = makeLedgerDb();
    useDb(db);

    const results = await Promise.all([
      awardMilestone(USER, "first_review"),
      awardMilestone(USER, "first_review"),
      awardMilestone(USER, "first_review"),
    ]);

    // Genau ein Anlauf trägt den Bonus, die anderen kommen leer zurück …
    expect(results.filter(Boolean)).toHaveLength(1);
    // … und im Konto liegt der Betrag genau einmal.
    expect(db.balance()).toBe(LP_EARN_RULES.firstReview);
    expect(db.ledger).toEqual([
      { reason: "milestone_first_review", amount: LP_EARN_RULES.firstReview },
    ]);
  });

  it("verschiedene Meilensteine sperren sich nicht gegenseitig", async () => {
    const db = makeLedgerDb();
    useDb(db);

    await awardMilestone(USER, "first_deck");
    await awardMilestone(USER, "first_review");

    expect(db.balance()).toBe(LP_EARN_RULES.firstDeck + LP_EARN_RULES.firstReview);
  });

  it("wirft nie — eine klemmende Gutschrift darf das auslösende Ereignis nicht kippen", async () => {
    useDb({
      rpc: vi.fn(async () => ({ data: null, error: { message: "Datenbank weg" } })),
    });

    await expect(awardMilestone(USER, "first_deck")).resolves.toBeNull();
  });
});

describe("awardFirstDeckMilestone", () => {
  it("liefert eine Liste, damit die Antwort immer dieselbe Form hat", async () => {
    const db = makeLedgerDb();
    useDb(db);

    await expect(awardFirstDeckMilestone(USER)).resolves.toEqual([
      { key: "first_deck", lpGranted: LP_EARN_RULES.firstDeck },
    ]);
    // Beim zweiten Deck bleibt die Liste leer statt null zu sein.
    await expect(awardFirstDeckMilestone(USER)).resolves.toEqual([]);
  });
});

describe("awardSessionMilestones", () => {
  it("zahlt beim ersten Sitzungsende die erste Lernsitzung", async () => {
    const db = makeLedgerDb();
    useDb(db);
    streak(1);

    await expect(awardSessionMilestones(USER)).resolves.toEqual([
      { key: "first_review", lpGranted: LP_EARN_RULES.firstReview },
    ]);
  });

  it("meldet ab der zweiten Sitzung nichts mehr", async () => {
    const db = makeLedgerDb();
    useDb(db);
    streak(2);

    await awardSessionMilestones(USER);
    await expect(awardSessionMilestones(USER)).resolves.toEqual([]);
    expect(db.balance()).toBe(LP_EARN_RULES.firstReview);
  });

  it.each([
    [7, "streak_7", LP_EARN_RULES.streakDay7],
    [30, "streak_30", LP_EARN_RULES.streakDay30],
    [100, "streak_100", LP_EARN_RULES.streakDay100],
  ])("zahlt bei %i Tagen den passenden Streak-Bonus", async (days, key, lp) => {
    const db = makeLedgerDb();
    useDb(db);
    streak(days);

    const awards = await awardSessionMilestones(USER);

    expect(awards).toContainEqual({ key, lpGranted: lp });
  });

  it.each([0, 1, 3, 6])("zahlt unterhalb von 7 Tagen keinen Streak-Bonus", async (days) => {
    const db = makeLedgerDb();
    useDb(db);
    streak(days);

    const awards = await awardSessionMilestones(USER);

    expect(awards.map((a) => a.key)).toEqual(["first_review"]);
  });

  it.each([
    [8, ["streak_7"]],
    [31, ["streak_7", "streak_30"]],
    [101, ["streak_7", "streak_30", "streak_100"]],
  ])(
    "zahlt bei %i Tagen alle bis dahin erreichten Stufen (>=), nicht nur die exakte",
    async (days, keys) => {
      const db = makeLedgerDb();
      useDb(db);
      streak(days);

      const awards = await awardSessionMilestones(USER);

      expect(awards.map((a) => a.key).sort()).toEqual(["first_review", ...keys].sort());
    }
  );

  it("holt den 30-Tage-Bonus nach, wenn Tag 30 genau verpasst wurde (#702)", async () => {
    const db = makeLedgerDb();
    useDb(db);

    // Tag 7: regulär verrechnet, streak_7 fließt.
    streak(7);
    await awardSessionMilestones(USER);

    // Tag 30 wird verpasst (App zu, kein Netz) — die nächste Sitzung endet
    // erst bei Streak 31, „genau 30" wird nie wieder erreicht. Mit der alten
    // `!==`-Prüfung wäre der Bonus für immer verloren; `>=` holt ihn nach.
    streak(31);
    const awards = await awardSessionMilestones(USER);

    expect(awards).toEqual([{ key: "streak_30", lpGranted: LP_EARN_RULES.streakDay30 }]);
    expect(db.balance()).toBe(
      LP_EARN_RULES.firstReview + LP_EARN_RULES.streakDay7 + LP_EARN_RULES.streakDay30
    );
  });

  it("zahlt denselben Streak-Bonus nicht zweimal, wenn am selben Tag zwei Sitzungen enden", async () => {
    const db = makeLedgerDb();
    useDb(db);
    streak(7);

    await awardSessionMilestones(USER);
    const second = await awardSessionMilestones(USER);

    expect(second).toEqual([]);
    expect(db.balance()).toBe(LP_EARN_RULES.firstReview + LP_EARN_RULES.streakDay7);
  });

  it("liefert die erste Lernsitzung auch dann, wenn der Streak-Stand nicht lesbar ist", async () => {
    const db = makeLedgerDb();
    useDb(db);
    vi.mocked(getStreakInfo).mockRejectedValue(new Error("Profil weg"));

    await expect(awardSessionMilestones(USER)).resolves.toEqual([
      { key: "first_review", lpGranted: LP_EARN_RULES.firstReview },
    ]);
  });
});
