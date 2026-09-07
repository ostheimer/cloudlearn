import type { BufferedReview } from "./reviewSendBuffer";

/** Commit the held answer before a background bookmark can skip over it. */
export function commitReviewBeforeBackground<Op>({
  buffer,
  enqueue,
  persist,
  onCommitted,
  send,
  track,
}: {
  buffer: { flush(): BufferedReview<Op> | null };
  enqueue: (operation: Op) => void;
  persist: () => Promise<void>;
  onCommitted: () => void;
  send: () => Promise<unknown>;
  track: (pending: Promise<unknown>) => void;
}): Promise<void> {
  const pending = buffer.flush();
  if (pending) {
    // The original operation/key survives a killed request and queue retries.
    enqueue(pending.queuedReview);
    onCommitted();
  }
  // Also retry persistence after an earlier storage failure, even though the
  // buffer has already been committed and the operation now lives in the queue.
  const persisted = persist();
  if (pending) track(persisted.then(send).catch(() => {}));
  return persisted;
}
