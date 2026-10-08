import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/api", () => ({
  getServerProgress: vi.fn(),
  putServerProgress: vi.fn(),
  deleteServerProgress: vi.fn(),
}));
vi.mock("./sessionProgress", () => ({
  clearSessionProgress: vi.fn(),
  loadSessionProgress: vi.fn(),
}));

import { deleteServerProgress, getServerProgress, putServerProgress } from "../../lib/api";
import { clearSessionProgress, loadSessionProgress } from "./sessionProgress";
import { clearProgressEverywhere, loadBestProgress, pushProgressToAccount } from "./sessionProgressSync";

const progress = {
  index: 1,
  cardId: "card-b",
  source: "due",
  reverse: false,
  total: 3,
  cardIds: ["card-a", "card-b", "card-c"],
  results: { "card-a": { correct: true, overridden: false } },
};

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadSessionProgress).mockResolvedValue(null);
  vi.mocked(clearSessionProgress).mockResolvedValue(undefined);
  vi.mocked(putServerProgress).mockResolvedValue({ saved: true });
  vi.mocked(deleteServerProgress).mockResolvedValue({ cleared: true });
});

describe("account session progress", () => {
  it("retains the original ordered queue when uploading and reading progress", async () => {
    await pushProgressToAccount("deck", "flashcards", progress);
    expect(putServerProgress).toHaveBeenCalledWith("deck", "flashcards", progress);
    vi.mocked(getServerProgress).mockResolvedValue({ ...progress, savedAt: "2026-09-08T09:00:00.000Z" });
    expect(await loadBestProgress("deck", "flashcards")).toEqual({
      ...progress, savedAt: "2026-09-08T09:00:00.000Z",
    });
  });

  it("finishes an in-flight background save before deleting a completed round", async () => {
    const pending = deferred();
    const calls: string[] = [];
    vi.mocked(putServerProgress).mockImplementationOnce(async () => {
      calls.push("put-start");
      await pending.promise;
      calls.push("put-finish");
      return { saved: true };
    });
    vi.mocked(deleteServerProgress).mockImplementationOnce(async () => {
      calls.push("delete");
      return { cleared: true };
    });
    const saving = pushProgressToAccount("deck", "flashcards", progress);
    await vi.waitFor(() => expect(calls).toContain("put-start"));
    const clearing = clearProgressEverywhere("deck", "flashcards");
    await vi.waitFor(() => expect(clearSessionProgress).toHaveBeenCalled());
    const deletedEarly = vi.mocked(deleteServerProgress).mock.calls.length;
    pending.resolve();
    await Promise.all([saving, clearing]);
    expect(deletedEarly).toBe(0);
    expect(calls).toEqual(["put-start", "put-finish", "delete"]);
  });

  it("does not block another deck behind a slow save", async () => {
    const pending = deferred();
    vi.mocked(putServerProgress).mockImplementationOnce(async () => {
      await pending.promise;
      return { saved: true };
    });
    const saving = pushProgressToAccount("deck", "flashcards", progress);
    await vi.waitFor(() => expect(putServerProgress).toHaveBeenCalled());
    await clearProgressEverywhere("another-deck", "flashcards");
    expect(deleteServerProgress).toHaveBeenCalledWith("another-deck", "flashcards");
    pending.resolve();
    await saving;
  });

  it("still deletes after a failed background save", async () => {
    vi.mocked(putServerProgress).mockRejectedValueOnce(new Error("offline"));
    await Promise.all([
      pushProgressToAccount("deck", "flashcards", progress),
      clearProgressEverywhere("deck", "flashcards"),
    ]);
    expect(deleteServerProgress).toHaveBeenCalledWith("deck", "flashcards");
  });

  it("reserves the delete before awaiting local storage, so a new round stays newer", async () => {
    const localDelete = deferred();
    const calls: string[] = [];
    vi.mocked(clearSessionProgress).mockReturnValueOnce(localDelete.promise);
    vi.mocked(deleteServerProgress).mockImplementationOnce(async () => {
      calls.push("delete");
      return { cleared: true };
    });
    vi.mocked(putServerProgress).mockImplementationOnce(async () => {
      calls.push("new-round");
      return { saved: true };
    });
    const clearing = clearProgressEverywhere("deck", "flashcards");
    await pushProgressToAccount("deck", "flashcards", progress);
    localDelete.resolve();
    await clearing;
    expect(calls).toEqual(["delete", "new-round"]);
  });
});
