/**
 * #427: „Erzeugen, aber noch nicht speichern" — und der zweite Halbschritt, der
 * die vom Menschen durchgesehenen Karten ablegt.
 *
 * Die Eigenschaft, die zählt, ist eine Nicht-Eigenschaft: In der Vorschau darf
 * NICHTS in die Datenbank wandern. Sonst stünde nach dem Verwerfen ein Deck da,
 * das niemand wollte — genau der Zustand, den die Vorschau abschaffen soll.
 *
 * Gegenprobe zu importPlanLimits.test.ts: Dort wird geprüft, dass Grenzen VOR
 * dem Modell greifen; hier, dass die Grenzen beim späteren Ablegen genauso
 * gelten, obwohl dabei keine Lernpunkte mehr fließen.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER_ID = "6e5db9e4-7e48-4e11-8d8c-6ca90c18d42a";
const DECK_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

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
    tags: [],
    createdAt: "2026-07-21T00:00:00.000Z",
    updatedAt: "2026-07-21T00:00:00.000Z",
  };
}

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
  insertCards: vi.fn(async (_userId: string, _deckId: string, cards: unknown[]) =>
    cards.map(() => {
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

vi.mock("@/lib/llm", () => ({
  generateFlashcardsAsync: vi.fn(),
  generateFlashcardsFromImageAsync: vi.fn(),
  generateFlashcardsFromUrlContentAsync: vi.fn(),
}));
vi.mock("@/lib/pdf", () => ({ extractPdfText: vi.fn() }));
vi.mock("@/lib/urlContentExtractor", () => ({ extractUrlContent: vi.fn() }));
vi.mock("@/lib/idempotencyStore", () => ({
  getIdempotentResult: vi.fn(),
  storeIdempotentResult: vi.fn(),
}));
vi.mock("@/services/subscriptionService", () => ({ getSubscriptionStatus: vi.fn() }));

import { insertCards, recordScan } from "@/lib/db";
import { generateFlashcardsAsync, generateFlashcardsFromUrlContentAsync } from "@/lib/llm";
import { extractPdfText } from "@/lib/pdf";
import { extractUrlContent } from "@/lib/urlContentExtractor";
import { getIdempotentResult, storeIdempotentResult } from "@/lib/idempotencyStore";
import { getSubscriptionStatus } from "@/services/subscriptionService";
import { processScan } from "@/services/scanService";
import { processPdfImport } from "@/services/pdfImportService";
import { processUrlImport } from "@/services/urlImportService";
import { saveImportedCards } from "@/services/importSaveService";

const mockedInsertCards = vi.mocked(insertCards);
const mockedRecordScan = vi.mocked(recordScan);
const mockedGenerateText = vi.mocked(generateFlashcardsAsync);
const mockedGenerateUrl = vi.mocked(generateFlashcardsFromUrlContentAsync);
const mockedExtractPdf = vi.mocked(extractPdfText);
const mockedExtractUrl = vi.mocked(extractUrlContent);
const mockedGetIdempotentResult = vi.mocked(getIdempotentResult);
const mockedStoreIdempotentResult = vi.mocked(storeIdempotentResult);
const mockedSubscription = vi.mocked(getSubscriptionStatus);

function cards(count: number, prefix = "Frage") {
  return Array.from({ length: count }, (_value, index) => ({
    front: `${prefix} ${index}`,
    back: `Antwort ${index}`,
    type: "basic" as const,
    difficulty: "medium" as const,
    tags: [] as string[],
  }));
}

function setTier(tier: "free" | "pro" | "lifetime"): void {
  mockedSubscription.mockResolvedValue({
    userId: USER_ID,
    tier,
    isActive: tier !== "free",
    expiresAt: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbState.deckIds = [];
  dbState.cardIds = [];
  dbState.nextCardId = 0;
  setTier("free");
  mockedGetIdempotentResult.mockResolvedValue(null);
  mockedGenerateText.mockResolvedValue({
    cards: cards(6),
    model: "gemini",
    fallbackUsed: false,
    title: "PIT Kapitel 4",
  });
  mockedGenerateUrl.mockResolvedValue({
    cards: cards(6),
    model: "gemini",
    fallbackUsed: false,
    title: "Webseite",
  });
  mockedExtractPdf.mockResolvedValue({
    extractedText: "Lernstoff aus dem Skript.",
    pageCount: 3,
  });
  mockedExtractUrl.mockResolvedValue({
    sourceUrl: "https://example.com",
    pageTitle: "Beispiel",
    extractedText: "Inhalt",
    images: [],
  });
});

describe("Vorschau: erzeugen ohne zu speichern (#427)", () => {
  it("legt beim Scan nichts an und gibt alle Karten zurück", async () => {
    const result = await processScan(
      {
        userId: USER_ID,
        extractedText: "Mitochondrien erzeugen ATP.",
        idempotencyKey: "vorschau-scan",
        preview: true,
      },
      "req-1",
      USER_ID
    );

    expect(mockedInsertCards).not.toHaveBeenCalled();
    expect(dbState.deckIds).toHaveLength(0);
    expect(result.cards).toHaveLength(6);
    expect(result.savedCount).toBe(0);
    expect(result.generatedCount).toBe(6);
    expect(result.deckTitle).toBe("PIT Kapitel 4");
  });

  it("legt auch bei PDF und URL nichts an", async () => {
    const pdf = await processPdfImport(
      {
        userId: USER_ID,
        fileName: "Skript.pdf",
        fileBase64: "A".repeat(200),
        idempotencyKey: "vorschau-pdf",
        preview: true,
      },
      "req-2",
      USER_ID
    );
    const url = await processUrlImport(
      {
        userId: USER_ID,
        sourceUrl: "https://example.com",
        idempotencyKey: "vorschau-url",
        preview: true,
      },
      "req-3",
      USER_ID
    );

    expect(mockedInsertCards).not.toHaveBeenCalled();
    expect(dbState.deckIds).toHaveLength(0);
    expect(pdf.savedCount).toBe(0);
    expect(url.savedCount).toBe(0);
  });

  it("schreibt den Scan trotzdem in die Historie — er hat stattgefunden", async () => {
    // Er kostet Lernpunkte, ob am Ende gespeichert wird oder nicht. Fehlte er in
    // der Historie, sähe die Abrechnung nach einem Verwerfen unerklärlich aus.
    await processScan(
      {
        userId: USER_ID,
        extractedText: "Text",
        idempotencyKey: "vorschau-historie",
        preview: true,
      },
      "req-4",
      USER_ID
    );
    expect(mockedRecordScan).toHaveBeenCalledWith(USER_ID, "gemini", 0, "", "Text");
  });

  it("speichert weiterhin sofort, wenn keine Vorschau verlangt ist", async () => {
    // Der alte Weg muss unberührt bleiben: App und ältere Clients kennen den
    // Schalter nicht und dürfen sich nicht anders verhalten als bisher.
    const result = await processScan(
      { userId: USER_ID, extractedText: "Text", idempotencyKey: "ohne-vorschau" },
      "req-5",
      USER_ID
    );
    expect(mockedInsertCards).toHaveBeenCalledTimes(1);
    expect(result.savedCount).toBe(6);
  });

  it("prüft ein bereits genanntes Deck auch in der Vorschau", async () => {
    // Ist das Ziel voll, wäre die Erzeugung Geldverbrennung: Der Fehler muss
    // fallen, BEVOR das Modell läuft.
    dbState.deckIds = [DECK_ID];
    dbState.cardIds = Array.from({ length: 150 }, (_v, i) => `alt-${i}`);

    await expect(
      processScan(
        {
          userId: USER_ID,
          extractedText: "Text",
          idempotencyKey: "vorschau-volles-deck",
          deckId: DECK_ID,
          preview: true,
        },
        "req-6",
        USER_ID
      )
    ).rejects.toMatchObject({ code: "DECK_FULL" });
    expect(mockedGenerateText).not.toHaveBeenCalled();
  });

  it("speichert auch mit genanntem Deck NICHT vorzeitig", async () => {
    // Der eigentliche Fallstrick: „deckId gesetzt" heißt nicht „jetzt ablegen".
    dbState.deckIds = [DECK_ID];

    const result = await processScan(
      {
        userId: USER_ID,
        extractedText: "Text",
        idempotencyKey: "vorschau-mit-deck",
        deckId: DECK_ID,
        preview: true,
      },
      "req-7",
      USER_ID
    );

    expect(mockedInsertCards).not.toHaveBeenCalled();
    expect(result.savedCount).toBe(0);
  });
});

describe("Ablegen der durchgesehenen Karten (#427)", () => {
  const saveBody = (extra: Record<string, unknown> = {}) => ({
    userId: USER_ID,
    cards: cards(3, "Bearbeitet"),
    idempotencyKey: "speichern-1",
    ...extra,
  });

  it("legt ein neues Deck mit dem gewünschten Titel an", async () => {
    const result = await saveImportedCards(saveBody({ title: "PIT Kapitel 4" }), "req-8", USER_ID);

    expect(result.deckTitle).toBe("PIT Kapitel 4");
    expect(result.savedCount).toBe(3);
    expect(mockedInsertCards).toHaveBeenCalledTimes(1);
  });

  it("speichert die Fassung der Nutzerin, nicht die des Modells", async () => {
    const result = await saveImportedCards(saveBody(), "req-9", USER_ID);
    expect(result.cards[0].front).toBe("Bearbeitet 0");
  });

  it("hängt an ein bestehendes Deck an", async () => {
    dbState.deckIds = [DECK_ID];
    dbState.cardIds = ["alt-0"];

    const result = await saveImportedCards(saveBody({ deckId: DECK_ID }), "req-10", USER_ID);

    expect(result.deckId).toBe(DECK_ID);
    expect(result.savedCount).toBe(3);
  });

  it("lehnt ein volles Deck mit 409 ab, statt Karten zu verlieren", async () => {
    dbState.deckIds = [DECK_ID];
    dbState.cardIds = Array.from({ length: 150 }, (_v, i) => `alt-${i}`);

    await expect(
      saveImportedCards(saveBody({ deckId: DECK_ID }), "req-11", USER_ID)
    ).rejects.toMatchObject({ code: "DECK_FULL", status: 409 });
  });

  it("dünnt aus, wenn nur ein Teil hineinpasst, und sagt es in den Zahlen", async () => {
    dbState.deckIds = [DECK_ID];
    dbState.cardIds = Array.from({ length: 149 }, (_v, i) => `alt-${i}`);

    const result = await saveImportedCards(saveBody({ deckId: DECK_ID }), "req-12", USER_ID);

    expect(result.savedCount).toBe(1);
    expect(result.generatedCount).toBe(3);
  });

  it("gibt beim zweiten Druck dasselbe Ergebnis statt doppelter Karten", async () => {
    const first = await saveImportedCards(saveBody({ title: "Einmalig" }), "req-13", USER_ID);
    expect(mockedStoreIdempotentResult).toHaveBeenCalledWith("speichern-1", first);

    mockedGetIdempotentResult.mockResolvedValueOnce(first);
    mockedInsertCards.mockClear();

    const second = await saveImportedCards(saveBody({ title: "Einmalig" }), "req-14", USER_ID);

    expect(second).toEqual(first);
    expect(mockedInsertCards).not.toHaveBeenCalled();
  });

  it("kostet keine Lernpunkte — die flossen beim Erzeugen", async () => {
    // Der Dienst kennt weder Guthaben noch Abzug; geprüft wird das hier über
    // seine Abhängigkeiten: Er ruft nichts aus dem LP-Bereich auf.
    const quelle = await import("node:fs/promises").then((fs) =>
      fs.readFile("src/services/importSaveService.ts", "utf-8")
    );
    expect(quelle).not.toMatch(/lpService|spendLp|runLpChargedIdempotentRequest/);
  });
});
