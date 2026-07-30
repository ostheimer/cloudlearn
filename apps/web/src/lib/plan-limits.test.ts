import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ getLpBalance: vi.fn() }));

vi.mock("@/lib/api", () => ({ getLpBalance: apiMocks.getLpBalance }));

import { loadPlanLimits, resetPlanLimitsCache } from "./plan-limits";

const USAGE = {
  limits: { maxDecks: 20, maxCardsPerDeck: 150 },
};

describe("Plan-Grenzen im Web, einmal je Sitzung (#611)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetPlanLimitsCache();
  });

  it("liefert die Grenzen des Endpunkts", async () => {
    apiMocks.getLpBalance.mockResolvedValue(USAGE);
    await expect(loadPlanLimits()).resolves.toEqual({ maxDecks: 20, maxCardsPerDeck: 150 });
  });

  it("fragt nur EINMAL, auch bei vielen Aufrufen", async () => {
    // Der Grund für diese Datei: Die Deck-Seite wird oft geöffnet, und eine
    // Anfrage pro Öffnen war der Einwand von #376 gegen jede Abfrage dort.
    apiMocks.getLpBalance.mockResolvedValue(USAGE);
    await loadPlanLimits();
    await loadPlanLimits();
    await loadPlanLimits();
    expect(apiMocks.getLpBalance).toHaveBeenCalledTimes(1);
  });

  it("bündelt gleichzeitige Aufrufer in eine Anfrage", async () => {
    // Bibliothek und Deck-Seite können zugleich fragen (Client-Navigation).
    apiMocks.getLpBalance.mockResolvedValue(USAGE);
    const [a, b] = await Promise.all([loadPlanLimits(), loadPlanLimits()]);
    expect(apiMocks.getLpBalance).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
  });

  it("behauptet nichts, wenn die Abfrage scheitert", async () => {
    // Unbekannte Grenzen sperren nichts (#603) — der Server lehnt notfalls ab.
    apiMocks.getLpBalance.mockRejectedValue(new Error("offline"));
    await expect(loadPlanLimits()).resolves.toEqual({
      maxDecks: undefined,
      maxCardsPerDeck: undefined,
    });
  });

  it("schreibt einen Fehlschlag NICHT für die ganze Sitzung fest", async () => {
    // Sonst bliebe der Füllstand nach einem einzigen Netz-Aussetzer bis zum
    // Neuladen der Seite verschwunden.
    apiMocks.getLpBalance.mockRejectedValueOnce(new Error("offline"));
    await loadPlanLimits();
    apiMocks.getLpBalance.mockResolvedValue(USAGE);
    await expect(loadPlanLimits()).resolves.toEqual({ maxDecks: 20, maxCardsPerDeck: 150 });
    expect(apiMocks.getLpBalance).toHaveBeenCalledTimes(2);
  });

  it("merkt sich auch keinen Server, der gar keine Grenzen kennt", async () => {
    // Älterer Server ohne `limits` — ebenfalls kein Grund, „unbekannt" für die
    // Sitzung einzufrieren.
    apiMocks.getLpBalance.mockResolvedValue({});
    await expect(loadPlanLimits()).resolves.toEqual({
      maxDecks: undefined,
      maxCardsPerDeck: undefined,
    });
    await loadPlanLimits();
    expect(apiMocks.getLpBalance).toHaveBeenCalledTimes(2);
  });
});
