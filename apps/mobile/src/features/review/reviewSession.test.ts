import { beforeEach, describe, expect, it } from "vitest";
import { useReviewSession } from "./reviewSession";

describe("review session", () => {
  beforeEach(() => {
    useReviewSession.getState().start([]);
  });

  it("tracks progress and completion", () => {
    useReviewSession.getState().start([
      { id: "1", front: "Q1", back: "A1" },
      { id: "2", front: "Q2", back: "A2" }
    ]);

    const first = useReviewSession.getState().rateCurrent("good");
    const second = useReviewSession.getState().rateCurrent("easy");

    expect(first?.cardId).toBe("1");
    expect(second?.cardId).toBe("2");
    expect(useReviewSession.getState().completed).toBe(true);
  });
});
