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

import { importFromUrl, importPdf, scanImage, scanText } from "./api";

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
    await scanText("user-1", "Text", "de", "stable-text-key");
    expect(lastRequestBody().idempotencyKey).toBe("stable-text-key");

    await scanImage("user-1", "AAA", "image/jpeg", "de", "stable-image-key");
    expect(lastRequestBody().idempotencyKey).toBe("stable-image-key");

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
    await importFromUrl("user-1", "https://example.com", 4, "de", "stable-url-key");
    expect(lastRequestBody().idempotencyKey).toBe("stable-url-key");

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
    await importPdf("user-1", "notes.pdf", "BBB", "de", "stable-pdf-key");
    expect(lastRequestBody().idempotencyKey).toBe("stable-pdf-key");
  });

  it("schickt preview nur, wenn ausdrücklich verlangt (#442)", async () => {
    // Ohne Flag verhält sich der Aufruf wie bisher: preview=false, der Server
    // speichert sofort. Mit true speichert er nichts — nur so entsteht kein
    // zweites Deck. Ein Regress hier bringt den Doppel-Deck-Bug zurück.
    await scanText("user-1", "Text", "de", "k1");
    expect(lastRequestBody().preview).toBe(false);

    await scanText("user-1", "Text", "de", "k2", true);
    expect(lastRequestBody().preview).toBe(true);

    await scanImage("user-1", "AAA", "image/jpeg", "de", "k3", true);
    expect(lastRequestBody().preview).toBe(true);
  });
});
