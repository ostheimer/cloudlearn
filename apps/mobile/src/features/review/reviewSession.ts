import { create } from "zustand";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  starred?: boolean;
}

/** Eigentümer-Kennung des Lern-Tabs (fällige Karten über alle Decks). */
export const GLOBAL_OWNER = "__global__";
/** Eigentümer-Kennung einer Vorgabe aus einem Ordner („Alle lernen"). */
export const PRESET_OWNER = "__preset__";

interface ReviewSessionState {
  cards: ReviewCard[];
  index: number;
  history: number[];
  ratingHistory: ReviewRating[];
  swipedLeft: number;
  swipedRight: number;
  revealed: boolean;
  completed: boolean;
  /**
   * Zählt, wie oft ein ANDERER Bildschirm eine Auswahl hierhergelegt hat
   * (Ordner „Alle lernen"). Der Lern-Tab merkt sich den zuletzt von ihm
   * gesehenen Stand: Ist die Zahl gewachsen, hat jemand bewusst etwas
   * hingelegt — dann darf er sie NICHT mit den global fälligen Karten
   * überschreiben (#282).
   *
   * Warum eine Zahl und kein Ja/Nein: Ein Ja/Nein müsste jemand
   * zurücksetzen, und wer das vergisst, blockiert das Nachladen für immer.
   * Eine Zahl, die nur wächst, kennt diesen Zustand nicht — jeder Leser
   * vergleicht sie mit dem, was er zuletzt gesehen hat.
   */
  presetToken: number;
  /**
   * WER die Karten hier hineingelegt hat (#282, zweiter Teil).
   *
   * Der Store ist modulglobal, der Merker jedes Bildschirms (`loadedKeyRef`)
   * dagegen ein `useRef` — also pro Komponenten-Instanz. Der Lern-Tab und
   * /deck-review sind verschiedene Instanzen: Eine Deck-Übung setzt IHREN
   * Merker, der Tab behält seinen auf "__global__". Zurück im Tab passte der
   * eigene Merker also weiterhin, im Stapel lagen aber die Übungskarten — der
   * Tab zeigte sie einfach weiter, bis jemand "Neu laden" tippte.
   *
   * Die Herkunft gehört deshalb an die Karten selbst, nicht in eine Notiz, die
   * jeder Leser getrennt führt. Werte: "__global__" (fällige Karten des
   * Lern-Tabs), eine Deck-ID, oder "__preset__" für eine Vorgabe aus
   * einem Ordner.
   */
  cardsOwner: string | null;
  /** `startIndex` resumes an interrupted deck session; defaults to the first card. */
  start: (cards: ReviewCard[], startIndex?: number, owner?: string) => void;
  /**
   * Wie `start`, aber als „von außen vorgegeben" markiert. Nur für
   * Bildschirme, die eine Auswahl treffen und dann zum Lern-Tab schicken.
   */
  startPreset: (cards: ReviewCard[]) => void;
  reveal: () => void;
  canGoBack: () => boolean;
  goBack: () => boolean;
  rateCurrent: (rating: ReviewRating) => { cardId: string; rating: ReviewRating } | null;
}

export const useReviewSession = create<ReviewSessionState>((set, get) => ({
  cards: [],
  index: 0,
  history: [],
  ratingHistory: [],
  swipedLeft: 0,
  swipedRight: 0,
  revealed: false,
  completed: false,
  presetToken: 0,
  cardsOwner: null,
  start: (cards, startIndex = 0, owner) =>
    set({
      cards,
      // Resuming an interrupted deck session (sessionProgress.ts). `history`
      // stays empty on purpose: the skipped cards were rated in the earlier
      // session and already sent, so stepping back into them would offer a
      // second rating for a card that has one.
      index: cards.length === 0 ? 0 : Math.min(Math.max(startIndex, 0), cards.length - 1),
      history: [],
      ratingHistory: [],
      swipedLeft: 0,
      swipedRight: 0,
      revealed: false,
      completed: cards.length === 0,
      // Ohne ausdrücklichen Eigentümer bleibt die Herkunft unbekannt (null).
      // Der Lern-Tab wertet das als "gehört mir nicht" und lädt neu — die
      // sichere Richtung: lieber einmal zu viel nachladen als der Nutzerin
      // fremde Karten unterschieben (#282).
      cardsOwner: owner ?? null
    }),
  startPreset: (cards) =>
    set((state) => ({
      cards,
      index: 0,
      history: [],
      ratingHistory: [],
      swipedLeft: 0,
      swipedRight: 0,
      revealed: false,
      completed: cards.length === 0,
      presetToken: state.presetToken + 1,
      cardsOwner: PRESET_OWNER
    })),
  reveal: () => set({ revealed: true }),
  canGoBack: () => get().history.length > 0,
  goBack: () => {
    const { history, ratingHistory, swipedLeft, swipedRight } = get();
    const previousIndex = history[history.length - 1];
    if (previousIndex === undefined) {
      return false;
    }

    // Decrement the counter that was incremented for the last rating
    const lastRating = ratingHistory[ratingHistory.length - 1];
    const wasLeft = lastRating === "again";

    set({
      index: previousIndex,
      history: history.slice(0, -1),
      ratingHistory: ratingHistory.slice(0, -1),
      swipedLeft: wasLeft ? Math.max(0, swipedLeft - 1) : swipedLeft,
      swipedRight: !wasLeft ? Math.max(0, swipedRight - 1) : swipedRight,
      revealed: false,
      completed: false
    });
    return true;
  },
  rateCurrent: (rating) => {
    const { cards, index, history, ratingHistory, swipedLeft, swipedRight } = get();
    const current = cards[index];
    if (!current) {
      return null;
    }

    const nextIndex = index + 1;
    const isLeft = rating === "again";
    set({
      index: nextIndex,
      history: [...history, index],
      ratingHistory: [...ratingHistory, rating],
      swipedLeft: isLeft ? swipedLeft + 1 : swipedLeft,
      swipedRight: !isLeft ? swipedRight + 1 : swipedRight,
      revealed: false,
      completed: nextIndex >= cards.length
    });

    return { cardId: current.id, rating };
  }
}));

// Cards the learner didn't know this session: those whose most recent rating was
// "again" (a left swipe or the "Nochmal" button — both record "again"). Uses the
// LAST rating per card so a card re-rated after "Zurück" (goBack) counts by its
// final answer, not an earlier one. Pure, so the result screen's "X von Y
// gewusst" and "only the missed ones" button are unit-testable.
export function missedCardsFrom(
  cards: ReviewCard[],
  history: number[],
  ratingHistory: ReviewRating[],
): ReviewCard[] {
  const lastRating = new Map<number, ReviewRating>();
  history.forEach((cardIndex, k) => {
    const rating = ratingHistory[k];
    if (rating) lastRating.set(cardIndex, rating);
  });
  const missed: ReviewCard[] = [];
  lastRating.forEach((rating, cardIndex) => {
    const card = cards[cardIndex];
    if (rating === "again" && card) missed.push(card);
  });
  return missed;
}
