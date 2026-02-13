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

  it("can navigate one card back", () => {
    useReviewSession.getState().start([
      { id: "1", front: "Q1", back: "A1" },
      { id: "2", front: "Q2", back: "A2" },
      { id: "3", front: "Q3", back: "A3" }
    ]);

    useReviewSession.getState().rateCurrent("good");
    useReviewSession.getState().rateCurrent("good");

    expect(useReviewSession.getState().index).toBe(2);
    expect(useReviewSession.getState().canGoBack()).toBe(true);

    const moved = useReviewSession.getState().goBack();
    expect(moved).toBe(true);
    expect(useReviewSession.getState().index).toBe(1);
    expect(useReviewSession.getState().completed).toBe(false);
  });

  it("counts swipedLeft for 'again' and swipedRight for other ratings", () => {
    useReviewSession.getState().start([
      { id: "1", front: "Q1", back: "A1" },
      { id: "2", front: "Q2", back: "A2" },
      { id: "3", front: "Q3", back: "A3" },
      { id: "4", front: "Q4", back: "A4" }
    ]);

    useReviewSession.getState().rateCurrent("again"); // left
    useReviewSession.getState().rateCurrent("good");  // right
    useReviewSession.getState().rateCurrent("hard");  // right
    useReviewSession.getState().rateCurrent("easy");  // right

    expect(useReviewSession.getState().swipedLeft).toBe(1);
    expect(useReviewSession.getState().swipedRight).toBe(3);
  });

  it("resets swipe counters on start", () => {
    useReviewSession.getState().start([
      { id: "1", front: "Q1", back: "A1" }
    ]);
    useReviewSession.getState().rateCurrent("again");
    expect(useReviewSession.getState().swipedLeft).toBe(1);

    // Restart
    useReviewSession.getState().start([
      { id: "2", front: "Q2", back: "A2" }
    ]);
    expect(useReviewSession.getState().swipedLeft).toBe(0);
    expect(useReviewSession.getState().swipedRight).toBe(0);
  });

  it("decrements correct counter on goBack", () => {
    useReviewSession.getState().start([
      { id: "1", front: "Q1", back: "A1" },
      { id: "2", front: "Q2", back: "A2" },
      { id: "3", front: "Q3", back: "A3" }
    ]);

    useReviewSession.getState().rateCurrent("again"); // left: 1
    useReviewSession.getState().rateCurrent("good");  // right: 1

    expect(useReviewSession.getState().swipedLeft).toBe(1);
    expect(useReviewSession.getState().swipedRight).toBe(1);

    // Go back undoes "good" -> right decrements
    useReviewSession.getState().goBack();
    expect(useReviewSession.getState().swipedLeft).toBe(1);
    expect(useReviewSession.getState().swipedRight).toBe(0);

    // Go back undoes "again" -> left decrements
    useReviewSession.getState().goBack();
    expect(useReviewSession.getState().swipedLeft).toBe(0);
    expect(useReviewSession.getState().swipedRight).toBe(0);
  });
});
