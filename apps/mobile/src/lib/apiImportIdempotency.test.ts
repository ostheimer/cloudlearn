import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { access_token: "test-token" } },
      })),
    },
  },
}));

import {
  importFromUrl,
  importPdf,
  saveImportedCards,
  scanImage,
  scanText,
} from "./api";

const fetchMock = vi.fn();

function jsonResponse(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  };
}

function lastRequestBody(): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("mobile import idempotency keys", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      jsonResponse({
        requestId: "req-1",
        model: "test",
        fallbackUsed: false,
        cards: [],
      })
    );
    vi.stubGlobal("fetch", fetchMock);
  });

  it("uses provided idempotency keys for all paid scan/import requests", async () => {
    await scanText("user-1", "Text", "de", "stable-text-key", true);
    expect(lastRequestBody().idempotencyKey).toBe("stable-text-key");
    expect(lastRequestBody().preview).toBe(true);

    await scanImage("user-1", "AAA", "image/jpeg", "de", "stable-image-key", true);
    expect(lastRequestBody().idempotencyKey).toBe("stable-image-key");
    expect(lastRequestBody().preview).toBe(true);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: "req-url",
        model: "test",
        fallbackUsed: false,
        cards: [],
        sourceUrl: "https://example.com",
        imagesUsed: 0,
      })
    );
    await importFromUrl("user-1", "https://example.com", 4, "de", "stable-url-key", true);
    expect(lastRequestBody().idempotencyKey).toBe("stable-url-key");
    expect(lastRequestBody().preview).toBe(true);

    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: "req-pdf",
        model: "test",
        fallbackUsed: false,
        cards: [],
        fileName: "notes.pdf",
        pageCount: 1,
        extractedCharacters: 10,
      })
    );
    await importPdf("user-1", "notes.pdf", "BBB", "de", "stable-pdf-key", true);
    expect(lastRequestBody().idempotencyKey).toBe("stable-pdf-key");
    expect(lastRequestBody().preview).toBe(true);
  });

  it("saves reviewed cards through the receipt-bound import endpoint", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        requestId: "req-save",
        deckId: "deck-1",
        deckTitle: "Biologie",
        cards: [],
        generatedCount: 3,
        savedCount: 3,
      })
    );

    await saveImportedCards(
      "user-1",
      [{ front: "Frage", back: "Antwort", type: "basic", difficulty: "medium", tags: [] }],
      {
        previewKind: "scan",
        previewIdempotencyKey: "stable-preview-key",
        deckId: "deck-1",
        title: "Biologie",
      }
    );

    const [url] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toContain("/api/v1/import/save");
    expect(lastRequestBody()).toMatchObject({
      userId: "user-1",
      previewKind: "scan",
      previewIdempotencyKey: "stable-preview-key",
      deckId: "deck-1",
      title: "Biologie",
    });
  });
});
