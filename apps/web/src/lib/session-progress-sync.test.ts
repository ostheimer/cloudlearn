import { beforeEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getServerProgress: vi.fn(),
  putServerProgress: vi.fn(),
  deleteServerProgress: vi.fn(),
}));
vi.mock("@/lib/session-progress", () => ({
  loadSessionProgress: vi.fn(() => null),
  clearSessionProgress: vi.fn(),
}));
vi.mock("@/lib/progress-merge", async () => import("./progress-merge"));

import { getServerProgress, putServerProgress } from "@/lib/api";
import { loadBestProgress, pushProgressToAccount } from "./session-progress-sync";

beforeEach(() => { vi.clearAllMocks(); });

it("preserves the original queue through an account upload and download", async () => {
  const progress = {
    index: 1,
    cardId: "card-b",
    cardIds: ["card-a", "card-b", "card-c"],
    source: "due",
    reverse: false,
    total: 3,
    results: { "card-a": { correct: true, overridden: false } },
  };
  await pushProgressToAccount("deck", "flashcards", progress);
  expect(putServerProgress).toHaveBeenCalledWith("deck", "flashcards", progress);
  vi.mocked(getServerProgress).mockResolvedValue({ ...progress, savedAt: "2026-09-08T09:00:00.000Z" });
  expect(await loadBestProgress("deck", "flashcards")).toEqual({
    ...progress, savedAt: "2026-09-08T09:00:00.000Z",
  });
});
