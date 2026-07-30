/**
 * #442/#427: Der Speicher-Halbschritt darf die Pro-Schranke nicht aufweichen.
 *
 * `POST /api/v1/import/save` nimmt Karten entgegen, die vom Client kommen und
 * bearbeitet sein dürfen. Damit steht dort dieselbe Frage wie beim Anlegen von
 * Hand, die `cardService.ts` seit #235 beantwortet: Bild-Occlusion ist eine
 * Pro-Funktion, und ein Gratis-Konto darf sie nicht dadurch erreichen, dass es
 * die Anfrage selbst zusammenbaut.
 *
 * Der Weg über den Import prüfte das zunächst nicht — dieser Test hält es fest.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";

const dbState = vi.hoisted(() => ({
  deckIds: [] as string[],
  cardIds: [] as string[],
  nextCardId: 0,
}));

function deckRecord(id: string) {
  return {
    id,
    userId: USER_ID,
    title: "Deck",
    tags: [] as string[],
    createdAt: "2026-07-22T00:00:00.000Z",
    updatedAt: "2026-07-22T00:00:00.000Z",
  };
}

// Der Import legt bei einem neuen Deck den „Erstes Deck"-Bonus an (#637).
// Hier gemockt, damit die Tests nicht gegen das echte LP-System laufen —
// was er auszahlt, prüft milestoneAwards.test.ts.
vi.mock("@/services/lpService", () => ({
  awardFirstDeckMilestone: vi.fn(async () => []),
}));

vi.mock("@/lib/db", () => ({
  getDeck: vi.fn(async (deckId: string) =>
    dbState.deckIds.includes(deckId) ? deckRecord(deckId) : null
  ),
  createDeck: vi.fn(async (_userId: string, title: string) => {
    const id = `deck-neu-${dbState.deckIds.length}`;
    dbState.deckIds.push(id);
    return { ...deckRecord(id), title };
  }),
  softDeleteDeck: vi.fn(async (deckId: string) => {
    dbState.deckIds = dbState.deckIds.filter((id) => id !== deckId);
    return true;
  }),
  listDeckIdsForUser: vi.fn(async () => [...dbState.deckIds]),
  insertCards: vi.fn(async (_userId: string, _deckId: string, list: unknown[]) =>
    list.map(() => {
      const id = `neu-${dbState.nextCardId++}`;
      dbState.cardIds.push(id);
      return { id };
    })
  ),
  listCardIdsForDeck: vi.fn(async () => [...dbState.cardIds]),
  softDeleteCardsByIds: vi.fn(async (_userId: string, _deckId: string, ids: string[]) => {
    dbState.cardIds = dbState.cardIds.filter((id) => !ids.includes(id));
    return ids.length;
  }),
  recordScan: vi.fn(async () => "scan-1"),
}));

vi.mock("@/lib/idempotencyStore", () => ({
  getIdempotentResult: vi.fn(),
  storeIdempotentResult: vi.fn(),
}));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));

import { insertCards } from "@/lib/db";
import { getIdempotentResult } from "@/lib/idempotencyStore";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { saveImportedCards } from "@/services/importSaveService";

const mockedInsertCards = vi.mocked(insertCards);
const mockedGetIdempotentResult = vi.mocked(getIdempotentResult);
const mockedSubscription = vi.mocked(getSubscriptionStatus);

function setTier(tier: "free" | "pro" | "lifetime"): void {
  mockedSubscription.mockResolvedValue({
    userId: USER_ID,
    tier,
    isActive: tier !== "free",
    expiresAt: null,
  });
}

function occlusionCard() {
  return {
    front: "Wo liegt der Hippocampus?",
    back: "Im Temporallappen",
    type: "occlusion" as const,
    difficulty: "medium" as const,
    tags: [] as string[],
    sourceImageUrl: "cards/hirn.png",
    extraData: { regions: [{ x: 0.1, y: 0.1, w: 0.2, h: 0.2 }], hideIndex: 0 },
  };
}

function basicCard() {
  return {
    front: "Frage",
    back: "Antwort",
    type: "basic" as const,
    difficulty: "medium" as const,
    tags: [] as string[],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  dbState.deckIds = [];
  dbState.cardIds = [];
  dbState.nextCardId = 0;
  mockedGetIdempotentResult.mockResolvedValue(null);
  setTier("free");
});

describe("import/save – Pro-Schranke für Bild-Occlusion (#442)", () => {
  it("lehnt Occlusion-Karten für ein Gratis-Konto ab, wie das Anlegen von Hand", async () => {
    // Gegenstück zu cardService.ts: dort `assertEntitlement(tier, "imageOcclusion")`
    // beim Anlegen einer einzelnen Karte. Ohne dieselbe Prüfung hier ist der
    // Pro-Schutz aus #235 über den Import-Weg umgehbar.
    await expect(
      saveImportedCards(
        {
          userId: USER_ID,
          cards: [occlusionCard()],
          title: "Umgehung",
          idempotencyKey: "gratis-occlusion-0001",
        },
        "req-occlusion-frei",
        USER_ID
      )
    ).rejects.toMatchObject({ status: 402, code: "PAYWALL_REQUIRED" });

    // Und es darf auch nichts halb geschrieben worden sein.
    expect(mockedInsertCards).not.toHaveBeenCalled();
  });

  it("lehnt auch ab, wenn die Occlusion-Karte zwischen harmlosen versteckt ist", async () => {
    // Eine Prüfung, die nur die erste Karte ansieht, würde hier durchwinken.
    await expect(
      saveImportedCards(
        {
          userId: USER_ID,
          cards: [basicCard(), basicCard(), occlusionCard()],
          title: "Gemischt",
          idempotencyKey: "gratis-occlusion-0002",
        },
        "req-occlusion-versteckt",
        USER_ID
      )
    ).rejects.toMatchObject({ status: 402, code: "PAYWALL_REQUIRED" });
    expect(mockedInsertCards).not.toHaveBeenCalled();
  });

  it("lässt Pro-Konten Occlusion-Karten speichern", async () => {
    // Die Schranke darf nicht pauschal sperren — sonst wäre die Funktion für
    // zahlende Konten kaputt.
    setTier("pro");
    const result = await saveImportedCards(
      {
        userId: USER_ID,
        cards: [occlusionCard()],
        title: "Anatomie",
        idempotencyKey: "pro-occlusion-0001",
      },
      "req-occlusion-pro",
      USER_ID
    );
    expect(result.savedCount).toBe(1);
  });

  it("lässt Gratis-Konten gewöhnliche Karten weiterhin speichern", async () => {
    // Der Normalfall des Vorschau-Ablaufs darf nicht mitgesperrt werden.
    const result = await saveImportedCards(
      {
        userId: USER_ID,
        cards: [basicCard(), basicCard()],
        title: "Vokabeln",
        idempotencyKey: "gratis-basic-0001",
      },
      "req-basic-frei",
      USER_ID
    );
    expect(result.savedCount).toBe(2);
  });
});
