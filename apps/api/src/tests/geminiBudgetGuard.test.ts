import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ remaining: 1, fail: false, disabled: false, settlements: [] as unknown[] }));
vi.mock("@/lib/supabase", () => ({ createSupabaseAdminClient: () => ({ rpc: vi.fn(async (name, args) => {
  if (state.fail) return { error: { message: "store down" }, data: null };
  if (name === "reserve_gemini_budget") {
    if (state.disabled) return { data: { status: "disabled" }, error: null };
    if (state.remaining-- <= 0) return { data: { status: "exhausted" }, error: null };
    return { data: { status: "reserved", reservationId: crypto.randomUUID() }, error: null };
  }
  state.settlements.push(args);
  return { data: { status: "settled" }, error: null };
}) }) }));
import { generateFlashcardsFromImage, generateFlashcardsFromText, generateFlashcardsFromWebContent } from "@/lib/flashcardGenerator";
const response = () => ({ ok: true, json: async () => ({ usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 20, totalTokenCount: 170 }, candidates: [{ content: { parts: [{ text: JSON.stringify({ title: "Biologie", cards: [{ front: "Was ist eine Zelle?", back: "Eine Einheit", type: "basic", difficulty: "medium", tags: [] }] }) }] } }] }) });
beforeEach(() => { state.remaining = 1; state.fail = false; state.disabled = false; state.settlements = []; vi.stubEnv("GEMINI_API_KEY", "local-test-key"); vi.stubGlobal("fetch", vi.fn(async () => response())); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("#756 provider guard", () => {
  it("does not call Gemini when exhausted", async () => { state.remaining = 0; await expect(generateFlashcardsFromImage("image", "image/jpeg", "de")).rejects.toMatchObject({ code: "AI_BUDGET_EXHAUSTED" }); expect(fetch).not.toHaveBeenCalled(); });
  it("admits only one of two concurrent calls into the last reservation", async () => { const results = await Promise.allSettled([generateFlashcardsFromText("Lerntext", "de"), generateFlashcardsFromImage("image", "image/jpeg", "de")]); expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(1); });
  it("fails closed on store outage", async () => { state.fail = true; await expect(generateFlashcardsFromWebContent({ sourceUrl: "https://example.test", pageTitle: "Test", textContent: "Text", language: "de", images: [] })).rejects.toMatchObject({ code: "AI_BUDGET_UNAVAILABLE" }); expect(fetch).not.toHaveBeenCalled(); });
  it("checks the kill switch before provider invocation", async () => { state.disabled = true; await expect(generateFlashcardsFromText("Text", "de")).rejects.toMatchObject({ code: "AI_DISABLED" }); expect(fetch).not.toHaveBeenCalled(); });
  it("settles measured input, candidates and thinking tokens", async () => { await generateFlashcardsFromText("Text", "de"); expect(state.settlements).toEqual([expect.objectContaining({ p_prompt_tokens: 100, p_output_tokens: 70 })]); });
  it("reserves each chunk and retry and cannot retry past the budget", async () => { state.remaining = 3; vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network failure"); })); await expect(generateFlashcardsFromText("x".repeat(18000), "de")).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(3); });
});

import { generateFlashcardsAsync, generateFlashcardsFromUrlContentAsync } from "@/lib/llm";
import { settleGeminiBudget } from "@/lib/geminiBudget";
import { HttpError } from "@/lib/http";
describe("control errors and uncertain billing", () => {
  it.each(["text", "url"])("does not hide the %s kill switch behind heuristics or retries", async source => {
    state.disabled = true;
    const job = source === "text" ? generateFlashcardsAsync("Ausreichend langer Lerntext.", "de") : generateFlashcardsFromUrlContentAsync({ sourceUrl: "https://example.test", pageTitle: "Test", extractedText: "Lerntext", images: [] }, "de");
    await expect(job).rejects.toMatchObject({ code: "AI_DISABLED" }); expect(fetch).not.toHaveBeenCalled();
  });
  it("retains holds when usage is absent or inconsistent", async () => {
    await settleGeminiBudget("test", undefined);
    await settleGeminiBudget("test", { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 5 });
    await settleGeminiBudget("test", { promptTokenCount: -10, candidatesTokenCount: 20, totalTokenCount: 10 });
    expect(state.settlements).toHaveLength(0);
  });
  it("surfaces settlement outages instead of retrying generation", async () => {
    state.fail = true;
    await expect(settleGeminiBudget("test", { promptTokenCount: 10, candidatesTokenCount: 20, totalTokenCount: 30 })).rejects.toBeInstanceOf(HttpError);
  });
});
