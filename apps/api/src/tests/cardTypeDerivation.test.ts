/**
 * Der Kartentyp auf der Achse basic↔cloze wird aus dem TEXT abgeleitet, nicht
 * vom Client bestimmt: eine {{cN::…}}-Markierung in der Vorderseite macht die
 * Karte zum Lückentext, ihr Fehlen zu basic. Hintergrund: die Lernmodi lesen
 * die Markierung direkt aus dem Text — ein von Hand umgestelltes Etikett ohne
 * Markierung änderte am Lernen nichts, verfälschte aber die Distraktoren-
 * Gruppierung im Quiz/Test (#380). Der frühere Kartentyp-Schalter im mobilen
 * Karten-Editor ist deshalb entfernt; alte App-Versionen schicken `type` noch
 * mit, der Server überstimmt es hier.
 *
 * Spezialtypen (occlusion, mcq, matching) tragen keine Markierung und dürfen
 * von der Ableitung NIE angefasst werden — weder beim expliziten Senden noch
 * indirekt durch eine reine Textänderung an einer bestehenden Karte.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { deriveCardType } from "@/lib/contracts";

const dbMocks = vi.hoisted(() => ({
  createCard: vi.fn(),
  getCard: vi.fn(),
  getDeck: vi.fn(),
  listCardsForDeck: vi.fn(),
  softDeleteCard: vi.fn(),
  updateCard: vi.fn(),
  getSubscriptionTier: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createCard: dbMocks.createCard,
  getCard: dbMocks.getCard,
  getDeck: dbMocks.getDeck,
  listCardsForDeck: dbMocks.listCardsForDeck,
  softDeleteCard: dbMocks.softDeleteCard,
  updateCard: dbMocks.updateCard,
  getSubscriptionTier: dbMocks.getSubscriptionTier,
}));

const userId = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const cardId = "1e5db9e4-7e48-4e11-8d8c-6ca90c18d42b";

const MIT_LUECKE = "Durch ein {{c1::Batch-Skript}} werden Treiber installiert.";
const OHNE_LUECKE = "Wozu dient ein Batch-Skript?";

describe("deriveCardType — der Text entscheidet", () => {
  it("erkennt die {{cN::…}}-Markierung", () => {
    expect(deriveCardType(MIT_LUECKE)).toBe("cloze");
    expect(deriveCardType("{{c2::zwei}} und {{c3::drei}}")).toBe("cloze");
  });

  it("ohne Markierung ist es basic — egal, was behauptet wird", () => {
    expect(deriveCardType(OHNE_LUECKE)).toBe("basic");
    expect(deriveCardType(OHNE_LUECKE, "cloze")).toBe("basic");
  });

  it("mit Markierung ist es cloze — auch wenn basic behauptet wird", () => {
    expect(deriveCardType(MIT_LUECKE, "basic")).toBe("cloze");
  });

  it("halbe Markierungen zählen nicht", () => {
    expect(deriveCardType("{{c1::offen bleibt offen")).toBe("basic");
    expect(deriveCardType("nur Klammern {{}} ohne Inhalt")).toBe("basic");
  });

  it("Spezialtypen werden durchgereicht, Markierung hin oder her", () => {
    expect(deriveCardType(MIT_LUECKE, "occlusion")).toBe("occlusion");
    expect(deriveCardType(OHNE_LUECKE, "mcq")).toBe("mcq");
    expect(deriveCardType(OHNE_LUECKE, "matching")).toBe("matching");
  });
});

/** Das `updates`-Objekt des einzigen erwarteten db.updateCard-Aufrufs. */
function lastUpdates(): Record<string, unknown> {
  expect(dbMocks.updateCard).toHaveBeenCalledTimes(1);
  const call = dbMocks.updateCard.mock.calls[0];
  if (!call) throw new Error("db.updateCard was not called");
  return call[2] as Record<string, unknown>;
}

describe("updateCardForUser — Ableitung beim Bearbeiten", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.updateCard.mockResolvedValue({ id: cardId, userId });
    dbMocks.getSubscriptionTier.mockResolvedValue({
      tier: "free",
      expiresAt: null,
      isActive: false,
    });
  });

  function existingCard(overrides: Record<string, unknown> = {}) {
    dbMocks.getCard.mockResolvedValue({
      id: cardId,
      userId,
      front: OHNE_LUECKE,
      back: "Antwort",
      type: "basic",
      ...overrides,
    });
  }

  it("Markierung in den Text schreiben macht die Karte zum Lückentext", async () => {
    const { updateCardForUser } = await import("@/services/cardService");
    existingCard();

    await updateCardForUser({ userId, cardId, front: MIT_LUECKE });

    expect(lastUpdates()).toEqual({ front: MIT_LUECKE, type: "cloze" });
  });

  it("Markierung entfernen macht die Karte wieder basic", async () => {
    const { updateCardForUser } = await import("@/services/cardService");
    existingCard({ front: MIT_LUECKE, type: "cloze" });

    await updateCardForUser({ userId, cardId, front: OHNE_LUECKE });

    expect(lastUpdates()).toEqual({ front: OHNE_LUECKE, type: "basic" });
  });

  it("ein reiner Typ-PATCH (alter App-Schalter) wird vom Text überstimmt", async () => {
    const { updateCardForUser } = await import("@/services/cardService");
    existingCard();

    await updateCardForUser({ userId, cardId, type: "cloze" });

    expect(lastUpdates()).toEqual({ type: "basic" });
  });

  it("eine Textänderung an einer occlusion-Karte lässt ihren Typ in Ruhe", async () => {
    const { updateCardForUser } = await import("@/services/cardService");
    existingCard({ type: "occlusion" });

    await updateCardForUser({ userId, cardId, front: "Neuer Bildtitel" });

    expect(lastUpdates()).toEqual({ front: "Neuer Bildtitel" });
  });

  it("ein { starred }-PATCH liest die Karte gar nicht erst", async () => {
    const { updateCardForUser } = await import("@/services/cardService");

    await updateCardForUser({ userId, cardId, starred: true });

    expect(dbMocks.getCard).not.toHaveBeenCalled();
    expect(lastUpdates()).toEqual({ starred: true });
  });

  it("verschwundene Karte → null, kein Schreibversuch", async () => {
    const { updateCardForUser } = await import("@/services/cardService");
    dbMocks.getCard.mockResolvedValue(null);

    const result = await updateCardForUser({ userId, cardId, front: "egal" });

    expect(result).toBeNull();
    expect(dbMocks.updateCard).not.toHaveBeenCalled();
  });
});
