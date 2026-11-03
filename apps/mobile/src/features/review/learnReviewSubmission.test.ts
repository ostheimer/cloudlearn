import { readFileSync } from "node:fs";
import { transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";
import { createReviewSendBuffer } from "./reviewSendBuffer";
import { useReviewSession } from "./reviewSession";

// Execute the screen's actual handler with delayed HTTP, including its real
// buffer and session store. A pure counting helper misses this async boundary.
const screen = readFileSync(new URL("../../../app/(tabs)/learn.tsx", import.meta.url), "utf8");
const handler = screen.slice(screen.indexOf("  const handleRate ="), screen.indexOf("  const handleSwipe ="));
const compile = transpileModule(`${handler}\nreturn handleRate;`, {}).outputText;

describe("last review registration before resume summary LP", () => {
  it("registers both final reviews before waiting for slow HTTP and does not resend seeded answers", async () => {
    const cards = ["a", "b", "c", "d"].map(id => ({ id, front: id, back: id }));
    const session = useReviewSession;
    session.getState().start(cards, 2, "deck", {
      a: { correct: true, overridden: false }, b: { correct: false, overridden: false },
    });
    const buffer = createReviewSendBuffer<{ cardId: string }>();
    const finish: Array<() => void> = [];
    const send = vi.fn((_review: { cardId: string }) => new Promise<void>(resolve => finish.push(resolve)));
    const rate = new Function("revealed", "reveal", "rateCurrent", "userId", "reviewBuffer", "createReviewSyncOperation", "sendReview", "useReviewSession", compile)(
      true, session.getState().reveal, session.getState().rateCurrent, "local-user", buffer,
      (value: { cardId: string }) => value, send, session,
    ) as (rating: "good") => Promise<void>;
    await rate("good");
    expect(send).not.toHaveBeenCalled();
    const final = rate("good");
    expect(session.getState().completed).toBe(true);
    // React can render the summary at the first await. Its counters and tracked
    // promises must already include the last card, even if the prior HTTP hangs.
    expect(send.mock.calls).toHaveLength(2);
    expect(send.mock.calls.map(args => args[0].cardId)).toEqual(["c", "d"]);
    expect(buffer.hasPending()).toBe(false);
    finish.forEach(resolve => resolve());
    await final;
    expect(send).toHaveBeenCalledTimes(2);
  });
});
