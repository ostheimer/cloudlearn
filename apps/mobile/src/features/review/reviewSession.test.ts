import { beforeEach, describe, expect, it } from "vitest";
import { useReviewSession, missedCardsFrom } from "./reviewSession";

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

describe("missedCardsFrom", () => {
  const cards = [
    { id: "1", front: "Q1", back: "A1" },
    { id: "2", front: "Q2", back: "A2" },
    { id: "3", front: "Q3", back: "A3" },
  ];

  it("returns the cards whose rating was 'again', in card order", () => {
    // card 0 -> again, card 1 -> good, card 2 -> again
    const missed = missedCardsFrom(cards, [0, 1, 2], ["again", "good", "again"]);
    expect(missed.map((c) => c.id)).toEqual(["1", "3"]);
  });

  it("treats every non-'again' rating (hard/good/easy) as known", () => {
    const missed = missedCardsFrom(cards, [0, 1, 2], ["hard", "good", "easy"]);
    expect(missed).toEqual([]);
  });

  it("uses the LAST rating per card, so a re-rated card counts by its final answer", () => {
    // card 0 rated "again", then (after going back) re-rated "good" -> known now
    const missed = missedCardsFrom([cards[0]!], [0, 0], ["again", "good"]);
    expect(missed).toEqual([]);
    // and the reverse: first "good", then re-rated "again" -> missed
    const missed2 = missedCardsFrom([cards[0]!], [0, 0], ["good", "again"]);
    expect(missed2.map((c) => c.id)).toEqual(["1"]);
  });

  it("returns an empty list for an untouched or empty session", () => {
    expect(missedCardsFrom([], [], [])).toEqual([]);
    expect(missedCardsFrom(cards, [], [])).toEqual([]);
  });

  it("matches what the store records after a real session", () => {
    useReviewSession.getState().start(cards);
    useReviewSession.getState().rateCurrent("again");
    useReviewSession.getState().rateCurrent("easy");
    useReviewSession.getState().rateCurrent("again");
    const { cards: c, history, ratingHistory } = useReviewSession.getState();
    expect(missedCardsFrom(c, history, ratingHistory).map((x) => x.id)).toEqual(["1", "3"]);
  });

  // ── Vorgabe von außen (#282) ──────────────────────────────────────────────
  //
  // „Alle lernen" im Ordner/Kurs sucht die Karten heraus, legt sie in diesen
  // Store und schickt zum Lern-Tab. Der lud beim ersten Fokus die global
  // fälligen Karten nach und überschrieb damit genau die Auswahl, die die
  // Nutzerin angetippt hatte. `presetToken` ist das Unterscheidungsmerkmal:
  // Der Lern-Tab vergleicht es mit dem zuletzt von ihm gesehenen Stand.

  it("zählt presetToken nur hoch, wenn ein anderer Bildschirm die Auswahl vorgibt", () => {
    const vorher = useReviewSession.getState().presetToken;

    // Der Lern-Tab selbst lädt über start() — das darf NICHT als Vorgabe gelten,
    // sonst würde er seine eigene Ladung für eine fremde halten.
    useReviewSession.getState().start([{ id: "1", front: "Q", back: "A" }]);
    expect(useReviewSession.getState().presetToken).toBe(vorher);

    useReviewSession.getState().startPreset([{ id: "2", front: "Q", back: "A" }]);
    expect(useReviewSession.getState().presetToken).toBe(vorher + 1);
  });

  it("setzt die Sitzung genauso zurück wie start", () => {
    useReviewSession.getState().start([
      { id: "1", front: "Q1", back: "A1" },
      { id: "2", front: "Q2", back: "A2" }
    ]);
    useReviewSession.getState().rateCurrent("again");

    useReviewSession.getState().startPreset([{ id: "9", front: "Q9", back: "A9" }]);

    const s = useReviewSession.getState();
    expect(s.cards.map((c) => c.id)).toEqual(["9"]);
    expect(s.index).toBe(0);
    expect(s.history).toEqual([]);
    expect(s.ratingHistory).toEqual([]);
    expect(s.swipedLeft).toBe(0);
    expect(s.swipedRight).toBe(0);
    expect(s.revealed).toBe(false);
    expect(s.completed).toBe(false);
  });

  it("wächst bei jeder Vorgabe weiter, statt zwischen zwei Werten zu pendeln", () => {
    // Ein Ja/Nein müsste jemand zurücksetzen; wer das vergisst, blockiert das
    // Nachladen dauerhaft. Eine nur wachsende Zahl kennt diesen Zustand nicht:
    // Zwei Vorgaben nacheinander sind zwei unterscheidbare Ereignisse.
    const start = useReviewSession.getState().presetToken;
    useReviewSession.getState().startPreset([{ id: "1", front: "Q", back: "A" }]);
    useReviewSession.getState().startPreset([{ id: "2", front: "Q", back: "A" }]);
    expect(useReviewSession.getState().presetToken).toBe(start + 2);
  });

  it("markiert auch eine leere Vorgabe (Ordner ohne lernbare Karten)", () => {
    // Sonst hielte der Lern-Tab die leere Auswahl für „nichts vorgegeben“ und
    // lüde die globalen Karten nach — die Nutzerin bekäme fremde Karten statt
    // des ehrlichen Hinweises, dass dieser Ordner nichts hergibt.
    const vorher = useReviewSession.getState().presetToken;
    useReviewSession.getState().startPreset([]);
    expect(useReviewSession.getState().presetToken).toBe(vorher + 1);
    expect(useReviewSession.getState().completed).toBe(true);
  });
});
