import { create } from "zustand";
import type { StoredCardResult } from "./sessionProgress";

export type ReviewRating = "again" | "hard" | "good" | "easy";

export interface ReviewCard {
  id: string;
  front: string;
  back: string;
  starred?: boolean;
  /**
   * Deck der Karte — nur fürs Vorlesen gebraucht (#571): Im Lern-Tab liegen
   * Karten aus vielen Decks gemischt, und jedes Deck bringt eigene Sprachen für
   * Vorder- und Rückseite mit. Optional, weil ältere gespeicherte Sitzungen und
   * andere Bildschirme das Feld nicht setzen; ohne Wert wird Deutsch gesprochen.
   */
  deckId?: string;
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
  /** Einstiegskarte dieser Runde — nur nach „Weitermachen" größer als 0 (#595). */
  startIndex: number;
  /**
   * Wie viele `history`-Einträge aus der gespeicherten Vor-Sitzung eingefüllt
   * wurden (#595): Sie zählen in Auswertung und „Nur die nicht gewussten" mit,
   * aber der Zurück-Pfeil darf sie nicht erreichen — ihre Bewertungen sind
   * längst beim Server, ein zweiter Besuch würde doppelt bewerten.
   */
  seededCount: number;
  /**
   * `startIndex` resumes an interrupted deck session; defaults to the first
   * card. `priorResults` (das Lesezeichen aus sessionProgress.ts) füllt die
   * Ergebnisse der Vor-Sitzung wieder ein.
   */
  start: (
    cards: ReviewCard[],
    startIndex?: number,
    owner?: string,
    priorResults?: Record<string, StoredCardResult>
  ) => void;
  /**
   * Wie `start`, aber als „von außen vorgegeben" markiert. Nur für
   * Bildschirme, die eine Auswahl treffen und dann zum Lern-Tab schicken.
   */
  startPreset: (cards: ReviewCard[]) => void;
  reveal: () => void;
  canGoBack: () => boolean;
  goBack: () => boolean;
  rateCurrent: (rating: ReviewRating) => { cardId: string; rating: ReviewRating } | null;
  /**
   * Karte im laufenden Stapel patchen (#610, Stift-Knopf): NICHT die ganze
   * Runde neu laden — das würde Index, Fortschritt und Bewertungen dieser
   * Sitzung zerstören.
   */
  patchCard: (cardId: string, updates: Partial<Pick<ReviewCard, "front" | "back">>) => void;
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
  startIndex: 0,
  seededCount: 0,
  start: (cards, startIndex = 0, owner, priorResults) => {
    // Resuming an interrupted deck session (sessionProgress.ts).
    const from =
      cards.length === 0 ? 0 : Math.min(Math.max(startIndex, 0), cards.length - 1);
    // Die Ergebnisse der Vor-Sitzung wieder einfüllen (#595, wie der
    // Lückentext): Als history-Einträge zählen sie in der Auswertung und im
    // „Nur die nicht gewussten"-Stapel mit. Nur unterhalb der Einstiegskarte —
    // alles ab dort wird in dieser Sitzung neu bewertet. Alte Lesezeichen ohne
    // Ergebnisse füllen nichts ein; die Auswertung nennt dann nur die aktuelle
    // Runde (sessionResultCounts).
    const history: number[] = [];
    const ratingHistory: ReviewRating[] = [];
    let swipedLeft = 0;
    let swipedRight = 0;
    if (priorResults) {
      for (let i = 0; i < from; i++) {
        const result = priorResults[cards[i]?.id ?? ""];
        if (!result) continue;
        history.push(i);
        // Die genaue Bewertung von damals steht nicht im Lesezeichen — für
        // Zählung und Wiederholungs-Stapel zählt nur gewusst / nicht gewusst.
        ratingHistory.push(result.correct ? "good" : "again");
        if (result.correct) swipedRight++;
        else swipedLeft++;
      }
    }
    set({
      cards,
      index: from,
      history,
      ratingHistory,
      swipedLeft,
      swipedRight,
      revealed: false,
      completed: cards.length === 0,
      startIndex: from,
      seededCount: history.length,
      // Ohne ausdrücklichen Eigentümer bleibt die Herkunft unbekannt (null).
      // Der Lern-Tab wertet das als "gehört mir nicht" und lädt neu — die
      // sichere Richtung: lieber einmal zu viel nachladen als der Nutzerin
      // fremde Karten unterschieben (#282).
      cardsOwner: owner ?? null
    });
  },
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
      startIndex: 0,
      seededCount: 0,
      presetToken: state.presetToken + 1,
      cardsOwner: PRESET_OWNER
    })),
  reveal: () => set({ revealed: true }),
  // Eingefüllte Vor-Sitzungs-Einträge sind für den Zurück-Pfeil tabu (#595):
  // ihre Bewertungen sind längst gesendet, ein Rückschritt würde eine zweite
  // Bewertung für eine Karte anbieten, die schon eine hat.
  canGoBack: () => get().history.length > get().seededCount,
  goBack: () => {
    const { history, ratingHistory, swipedLeft, swipedRight, seededCount } = get();
    if (history.length <= seededCount) {
      return false;
    }
    const previousIndex = history[history.length - 1];
    if (previousIndex === undefined) {
      return false;
    }

    // Decrement the counter that was incremented for the last rating
    const lastRating = ratingHistory[ratingHistory.length - 1];
    const wasLeft = lastRating === "again" || lastRating === "hard";

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
    // „Schwer" zählt wie „Nochmal" als nicht gewusst (#565, Laras Wortlaut-
    // Entscheidung) — Web und App rechnen damit gleich.
    const isLeft = rating === "again" || rating === "hard";
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
  },
  patchCard: (cardId, updates) => {
    set({
      cards: get().cards.map((c) => (c.id === cardId ? { ...c, ...updates } : c)),
    });
  }
}));

// Cards the learner didn't know this session: those whose most recent rating
// was "again" OR "hard" — „Schwer" heißt „nicht sicher gewusst" (#565, Laras
// Entscheidung; das Web zählte immer schon so). Uses the LAST rating per card
// so a card re-rated after "Zurück" (goBack) counts by its final answer, not
// an earlier one. Pure, so the result screen's "X von Y gewusst" and "only
// the missed ones" button are unit-testable.
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
    if ((rating === "again" || rating === "hard") && card) missed.push(card);
  });
  return missed;
}

// Für das Lesezeichen (#595): der Stand jeder in dieser Sitzung bewerteten
// Karte, per LETZTER Bewertung wie missedCardsFrom. Eingefüllte Vor-Sitzungs-
// Einträge stecken selbst in `history` und wandern so beim nächsten Speichern
// automatisch mit — eine zweite Unterbrechung verliert nichts.
export function storedResultsFrom(
  cards: ReviewCard[],
  history: number[],
  ratingHistory: ReviewRating[],
): Record<string, StoredCardResult> {
  const lastRating = new Map<number, ReviewRating>();
  history.forEach((cardIndex, k) => {
    const rating = ratingHistory[k];
    if (rating) lastRating.set(cardIndex, rating);
  });
  const results: Record<string, StoredCardResult> = {};
  lastRating.forEach((rating, cardIndex) => {
    const card = cards[cardIndex];
    if (!card) return;
    results[card.id] = {
      correct: rating === "good" || rating === "easy",
      // Karteikarten kennen kein „Trotzdem als richtig zählen" — das Feld
      // gehört zum geteilten StoredCardResult (Lückentext).
      overridden: false,
    };
  });
  return results;
}

// Was die Abschluss-Auswertung nennt (#595): alle Karten, für die es in dieser
// Sitzung ein Ergebnis gibt — die ab der Einstiegskarte neu bewerteten plus
// die aus der Vor-Sitzung eingefüllten. Bei einem alten Lesezeichen ohne
// gespeicherte Ergebnisse bleibt so ehrlich nur die aktuelle Runde übrig,
// statt übersprungene Karten als „gewusst" mitzuzählen.
export function sessionResultCounts(
  cardCount: number,
  startIndex: number,
  seededCount: number,
  missedCount: number,
): { total: number; known: number } {
  const total = seededCount + Math.max(0, cardCount - startIndex);
  return { total, known: Math.max(0, total - missedCount) };
}
