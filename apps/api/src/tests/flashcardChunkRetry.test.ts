/**
 * Long study material is generated one chunk at a time. These tests pin down
 * what happens when a chunk call fails, because getting that wrong is invisible
 * to the learner: a transient failure on chunk 1 of 3 once produced a deck that
 * silently lacked the whole first third of a chapter while looking complete.
 *
 * The Gemini HTTP call is stubbed; nothing leaves the machine.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { generateFlashcardsFromText } from "@/lib/flashcardGenerator";

// Long enough to be split into several chunks (splitStudyText cuts at ~8_000).
const LONG_TEXT = Array.from(
  { length: 400 },
  (_, i) => `Satz ${i} beschreibt einen Sachverhalt aus dem Lernstoff mit ausreichender Länge.`
).join(" ");

function geminiResponse(marker: string) {
  const payload = {
    title: `Deck ${marker}`,
    cards: [
      {
        front: `Frage aus ${marker}?`,
        back: `Antwort ${marker}`,
        type: "basic",
        difficulty: "medium",
        tags: ["t"],
      },
    ],
  };
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
  };
}

let originalKey: string | undefined;

beforeEach(() => {
  originalKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("chunked generation when a chunk call fails", () => {
  it("retries a chunk that fails once and keeps its cards", async () => {
    let calls = 0;
    let failedOnce = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls++;
        // Fail exactly one chunk on its first attempt.
        if (!failedOnce) {
          failedOnce = true;
          throw new Error("socket hang up");
        }
        return geminiResponse(`c${calls}`);
      })
    );

    const result = await generateFlashcardsFromText(LONG_TEXT, "de");

    // One card per chunk survives, including the chunk that first failed —
    // proof the retry recovered it rather than the chunk being dropped.
    expect(result.cards.length).toBeGreaterThanOrEqual(2);
    expect(calls).toBeGreaterThan(result.cards.length);
  });

  // The regression that motivated this file: one chunk down, deck shipped anyway.
  it("fails the whole generation rather than returning a partial deck", async () => {
    let doomedChunk: string | null = null;
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        // Key on the chunk's own text, not on a call counter: retries run
        // interleaved with the other chunks, so only the payload identifies
        // which chunk is being asked.
        const body = JSON.parse(init.body);
        const chunk = String(body.contents[0].parts[1].text);
        doomedChunk ??= chunk;
        calls++;
        if (chunk === doomedChunk) throw new Error("upstream unavailable");
        return geminiResponse(`c${calls}`);
      })
    );

    // No partial deck, no silent gap — the import fails and can be repeated.
    await expect(generateFlashcardsFromText(LONG_TEXT, "de")).rejects.toThrow(/attempts/i);
  });

  it("gives a chunk several attempts before giving up", async () => {
    const attempts = new Map<string, number>();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        // Identify the chunk by its payload so retries of the same chunk count.
        const body = JSON.parse(init.body);
        const key = String(body.contents[0].parts[1].text).slice(0, 60);
        const n = (attempts.get(key) ?? 0) + 1;
        attempts.set(key, n);
        throw new Error("always down");
      })
    );

    await expect(generateFlashcardsFromText(LONG_TEXT, "de")).rejects.toThrow();
    // Every chunk was tried more than once.
    for (const count of attempts.values()) expect(count).toBeGreaterThan(1);
  });

  it("still produces a deck when every chunk answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => geminiResponse("ok")));

    const result = await generateFlashcardsFromText(LONG_TEXT, "de");

    expect(result.title).toBe("Deck ok");
    // Identical questions across chunks are merged, so one card remains.
    expect(result.cards).toHaveLength(1);
  });
});
