import { describe, expect, it, vi } from "vitest";
import { createReviewSendBuffer } from "./reviewSendBuffer";
import { commitReviewBeforeBackground } from "./reviewBackgroundCommit";

describe("correction boundary for committed background reviews", () => {
  it("queues the original operation and waits for persistence before sending", async () => {
    const buffer = createReviewSendBuffer<{ idempotencyKey: string }>();
    const operation = { idempotencyKey: "original-key" };
    buffer.rate({ cardId: "a", rating: "again", queuedReview: operation });
    let finish!: () => void;
    const storageWrite = new Promise<void>((resolve) => { finish = resolve; });
    const enqueue = vi.fn();
    const send = vi.fn(async () => {});
    const onCommitted = vi.fn();
    const tracked: Promise<unknown>[] = [];
    const persisted = commitReviewBeforeBackground({
      buffer, enqueue, persist: () => storageWrite, onCommitted, send,
      track: (pending) => tracked.push(pending),
    });
    expect(enqueue).toHaveBeenCalledExactlyOnceWith(operation);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(buffer.canAmend("a")).toBe(false);
    expect(buffer.hasPending()).toBe(false);
    expect(send).not.toHaveBeenCalled();
    finish();
    await persisted;
    await Promise.all(tracked);
    expect(send).toHaveBeenCalledTimes(1);
    expect(tracked).toHaveLength(1);
  });

  it("keeps a failed storage commit queued and retryable without awarding the answer twice", async () => {
    const buffer = createReviewSendBuffer<string>();
    buffer.rate({ cardId: "a", rating: "good", queuedReview: "same-key" });
    const queued: string[] = [];
    const persist = vi.fn().mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValue(undefined);
    const onCommitted = vi.fn();
    const send = vi.fn(async () => {});
    const options = { buffer, enqueue: (key: string) => queued.push(key), persist, onCommitted, send, track: (_pending: Promise<unknown>) => {} };
    await expect(commitReviewBeforeBackground(options)).rejects.toThrow("storage unavailable");
    expect(queued).toEqual(["same-key"]);
    expect(send).not.toHaveBeenCalled();
    await commitReviewBeforeBackground(options);
    expect(persist).toHaveBeenCalledTimes(2);
    expect(onCommitted).toHaveBeenCalledTimes(1);
    expect(queued).toEqual(["same-key"]);
  });

  it("allows corrections only while the exact card is still buffered", () => {
    const buffer = createReviewSendBuffer<{ idempotencyKey: string }>();
    buffer.rate({ cardId: "a", rating: "again", queuedReview: { idempotencyKey: "original" } });
    expect(buffer.canAmend("a")).toBe(true);
    const committed = buffer.flush();
    expect(committed?.queuedReview.idempotencyKey).toBe("original");
    expect(buffer.canAmend("a")).toBe(false);
    expect(buffer.hasPending()).toBe(false);
    buffer.rate({ cardId: "b", rating: "again", queuedReview: { idempotencyKey: "next" } });
    expect(buffer.canAmend("a")).toBe(false);
    expect(buffer.canAmend("b")).toBe(true);
  });
});
