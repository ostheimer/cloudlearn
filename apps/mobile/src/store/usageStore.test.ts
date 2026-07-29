import { beforeEach, describe, expect, it } from "vitest";
import { usageFromBalanceResponse, useUsageStore } from "./usageStore";
import type { LpBalanceResponse } from "../lib/api";

const BALANCE_RESPONSE: LpBalanceResponse = {
  tier: "pro",
  lpBalance: 120,
  lpEarnedToday: 5,
  lpAdsToday: 0,
  lpEarnCapToday: 60,
  lpAdCapToday: 40,
  lpCostAiScan: 10,
  lpCostUrlImport: 15,
  lpCostPdfImport: 20,
  periodStart: "2026-07-01",
};

describe("usageStore.addLp", () => {
  beforeEach(() => {
    useUsageStore.getState().reset();
  });

  it("adds the grant to the current balance", () => {
    useUsageStore.getState().setUsage({ lpBalance: 10 });
    useUsageStore.getState().addLp(3);
    expect(useUsageStore.getState().lpBalance).toBe(13);
  });

  it("bases the new total on the freshest balance, not a stale snapshot", () => {
    // Reproduces the milestone-toast bug: the balance changes from elsewhere
    // AFTER a caller captured it. addLp reads the store itself, so the grant
    // must land on the fresh value (5), never on the captured one (10).
    useUsageStore.getState().setUsage({ lpBalance: 10 });
    // Something else moves the balance (e.g. a feature spend) in the meantime.
    useUsageStore.getState().setUsage({ lpBalance: 5 });
    useUsageStore.getState().addLp(3);
    expect(useUsageStore.getState().lpBalance).toBe(8);
  });

  it("ignores non-positive grants", () => {
    useUsageStore.getState().setUsage({ lpBalance: 10 });
    useUsageStore.getState().addLp(0);
    useUsageStore.getState().addLp(-4);
    expect(useUsageStore.getState().lpBalance).toBe(10);
  });
});

describe("Tarif-Grenzen im usageStore (#603)", () => {
  beforeEach(() => {
    useUsageStore.getState().reset();
  });

  it("startet mit unbekannten Grenzen, nicht mit den Gratis-Werten", () => {
    // Die alte Vorbelegung 20/150 zwang Pro-Konten die Free-Grenzen auf,
    // solange niemand die echten Grenzen nachlud.
    expect(useUsageStore.getState().maxDecks).toBeNull();
    expect(useUsageStore.getState().maxCardsPerDeck).toBeNull();
  });

  it("setUsage ohne Grenzen gilt nicht als „geladen mit Grenzen“", () => {
    // Genau so laden LP-Abzeichen und LP-Laden: nur der Kontostand. isLoaded
    // darf dabei kippen (Kontostand IST geladen) — die Grenzen bleiben
    // unbekannt, damit der Scan-Tab sie noch nachholt.
    useUsageStore.getState().setUsage({ lpBalance: 42 });
    expect(useUsageStore.getState().isLoaded).toBe(true);
    expect(useUsageStore.getState().maxDecks).toBeNull();
    expect(useUsageStore.getState().maxCardsPerDeck).toBeNull();
  });

  it("übernimmt die Server-Grenzen, wenn die Antwort sie mitbringt", () => {
    useUsageStore.getState().setUsage(
      usageFromBalanceResponse({
        ...BALANCE_RESPONSE,
        limits: { maxDecks: 2000, maxCardsPerDeck: 2000 },
      })
    );
    expect(useUsageStore.getState().maxDecks).toBe(2000);
    expect(useUsageStore.getState().maxCardsPerDeck).toBe(2000);
    expect(useUsageStore.getState().tier).toBe("pro");
  });

  it("lässt bekannte Grenzen stehen, wenn eine spätere Antwort keine mitbringt", () => {
    // Älterer Server oder Teil-Update (nur Kontostand): einmal gelernte
    // Grenzen dürfen nicht wieder auf „unbekannt" zurückfallen.
    useUsageStore.getState().setUsage(
      usageFromBalanceResponse({
        ...BALANCE_RESPONSE,
        limits: { maxDecks: 2000, maxCardsPerDeck: 2000 },
      })
    );
    useUsageStore.getState().setUsage(usageFromBalanceResponse(BALANCE_RESPONSE));
    expect(useUsageStore.getState().maxDecks).toBe(2000);
    expect(useUsageStore.getState().maxCardsPerDeck).toBe(2000);
  });

  it("reset macht die Grenzen wieder unbekannt", () => {
    useUsageStore.getState().setUsage({ maxDecks: 2000, maxCardsPerDeck: 2000 });
    useUsageStore.getState().reset();
    expect(useUsageStore.getState().maxDecks).toBeNull();
    expect(useUsageStore.getState().maxCardsPerDeck).toBeNull();
  });
});
