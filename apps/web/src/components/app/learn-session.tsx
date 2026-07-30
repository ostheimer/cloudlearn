"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/app/auth-context";
import {
  listDecks,
  reviewCard,
  updateCard,
  earnLp,
  type Card,
  type ReviewRating,
} from "@/lib/api";
import {
  DEFAULT_SPEECH_LANGUAGE,
  toSpeechLanguage,
  type SpeechLanguage,
} from "@/lib/speech-languages";
import { useDisplayName } from "@/lib/use-display-name";
import { cleanTerm, formatCloze, summarizeCardMedia } from "@/lib/card-display";
import { speechTexts } from "@/lib/speech-text";
import { useSpeech } from "@/lib/use-speech";
import {
  X,
  Trophy,
  Zap,
  Play,
  Pause,
  Timer,
  Volume2,
  Star,
  Pencil,
  ArrowLeft,
  Repeat,
} from "@/components/icons";
import { CardEditor } from "@/components/app/card-editor";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "@/lib/learn-session-lp";
import { useCoarsePointer } from "@/lib/use-coarse-pointer";
import { saveSessionProgress, type SessionProgress } from "@/lib/session-progress";
import { clearProgressEverywhere, pushProgressToAccount } from "@/lib/session-progress-sync";
import { createReviewSendBuffer } from "@/lib/review-send-buffer";
import { ratingKeyIndex } from "@/lib/learn-keys";
import {
  isCardGone,
  persistedReviewCount,
  unsavedReviewsNotice,
} from "@/lib/unsaved-reviews";

const RATINGS: { key: ReviewRating; label: string; cls: string }[] = [
  { key: "again", label: "Nochmal", cls: "rating--again" },
  { key: "hard", label: "Schwer", cls: "rating--hard" },
  { key: "good", label: "Gut", cls: "rating--good" },
  { key: "easy", label: "Leicht", cls: "rating--easy" },
];

// Wartezeit des Auto-Abspielens zwischen zwei Schritten — dieselbe Auswahl
// wie in der App, per Tipp auf die Anzeige durchgeschaltet.
const AUTO_PLAY_SPEEDS = [1, 3, 5, 10];

/**
 * The flip-and-rate session, shared by the deck and the folder learn pages.
 * The caller decides WHICH cards are studied and where "back" leads; everything
 * from here on — rating, LP, restart, „nur nicht gewusste" — is the same either
 * way. `pool` is the full round: it must already be filtered (no occlusion
 * cards) and stay referentially stable, since „Alle nochmal" restores it.
 *
 * Weitermachen (sessionProgress wie in der App): Sind `progressDeckId` und
 * `progressSource` gesetzt, merkt sich die Runde bei jedem Kartenwechsel ihre
 * Position im Browser und löscht den Merker am Rundenende. Nur das
 * Deck-Lernen setzt sie — beim Ordner-Lernen wechselt der Fällig-Stapel
 * täglich von selbst, ein gemerkter Stand wäre fast nie mehr gültig, und die
 * Wackelkandidaten-Sonderrunden (?cards=) startet man einfach neu.
 * `startAt` steigt mitten in der Runde ein, nachdem das Setup den Stand als
 * noch gültig geprüft und „Weitermachen" angeboten hat; `startReverse` stellt
 * dabei die Abfrage-Richtung der unterbrochenen Runde wieder her.
 *
 * Seit Laras Angleichung (#571 Teil B) spiegelt die Ansicht die App:
 * Zurück-Pfeil mit Rückgängig (Ein-Schritt-Puffer, review-send-buffer.ts),
 * Stern-Markieren, Richtung tauschen mitten in der Runde, rot/grün-Zähler
 * und ständig sichtbare Bewertungs-Knöpfe.
 */
export function LearnSession({
  pool,
  backHref,
  backLabel,
  startAt,
  startReverse,
  progressDeckId,
  progressSource,
}: {
  pool: Card[];
  backHref: string;
  backLabel: string;
  startAt?: number | undefined;
  startReverse?: boolean | undefined;
  progressDeckId?: string | undefined;
  progressSource?: string | undefined;
}) {
  const router = useRouter();
  const { userId } = useAuth();

  // Am Handy tippt man die Karte an, am Laptop klickt man sie — der Hinweis
  // auf der Kartenvorderseite muss die richtige Geste nennen (#521).
  const coarsePointer = useCoarsePointer();

  // `cards` is the queue actually being studied — possibly a subset of `pool`
  // after „Nur die nicht gewussten".
  const [cards, setCards] = useState<Card[]>(pool);
  const [index, setIndex] = useState(() =>
    Math.min(Math.max(startAt ?? 0, 0), Math.max(pool.length - 1, 0))
  );
  // Wo DIESE Runde begonnen hat: 0 normalerweise, beim Weitermachen die
  // Einstiegskarte. Die übersprungenen Karten wurden letztes Mal bewertet und
  // abgerechnet — Auswertung und LP zählen nur, was ab hier gelernt wurde.
  const [startIndex, setStartIndex] = useState(() =>
    Math.min(Math.max(startAt ?? 0, 0), Math.max(pool.length - 1, 0))
  );
  const [flipped, setFlipped] = useState(false);
  const [correct, setCorrect] = useState(0);
  const [notKnown, setNotKnown] = useState<Card[]>([]);
  // Abfrage-Richtung: false = Vorderseite zuerst. Mitten in der Runde
  // tauschbar wie in der App; beim Weitermachen wird die Richtung der
  // unterbrochenen Runde wiederhergestellt.
  const [reverse, setReverse] = useState(startReverse ?? false);
  // Stern-Stand je Karte, damit Markieren sofort sichtbar ist und die Runde
  // nicht neu laden muss (wie die starMap der App).
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(pool.map((c) => [c.id, c.starred ?? false]))
  );
  // Bewertete Karten dieser Sitzung, für den Zurück-Pfeil: welche Position
  // und welche Bewertung — so lassen sich Zähler und Stapel zurückdrehen.
  const [history, setHistory] = useState<{ index: number; rating: ReviewRating }[]>([]);
  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  // Anzeigename fürs persönliche Lob am Ende — ohne ihn bleibt es beim
  // schlichten "Runde geschafft!".
  const displayName = useDisplayName();
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  // Endgültig verlorene Bewertungen (#605): Ref für die Abrechnung (die läuft
  // in einem Callback und darf keinen veralteten State sehen), State für die
  // Ergebnis-Zeile. Beide werden immer zusammen fortgeschrieben.
  const unsavedRef = useRef(0);
  const [unsavedCount, setUnsavedCount] = useState(0);
  // Ein-Schritt-Puffer (#283-Muster der App): Die jüngste Bewertung bleibt
  // liegen, bis die nächste Karte bewertet ist — nur so kann der
  // Zurück-Pfeil sie folgenlos verwerfen.
  const reviewBufferRef = useRef(createReviewSendBuffer());
  // Die Karte selbst — nach jeder Bewertung wandert der Tastatur-Fokus hierher
  // zurück (siehe rate).
  const cardRef = useRef<HTMLDivElement>(null);
  // Stift-Knopf (#610): öffnet den Karten-Editor, ohne die Runde zu verlassen.
  const [editing, setEditing] = useState(false);

  const total = cards.length;
  const current = cards[index];
  const done = total > 0 && index >= total;
  // Welche Seite vorn abgefragt wird, entscheidet die Richtung.
  const shownFront = current ? (reverse ? current.back : current.front) : "";
  const shownBack = current ? (reverse ? current.front : current.back) : "";

  // Anzeige-Aufbereitung wie die App (#569, apps/mobile/app/(tabs)/learn.tsx):
  // Bild-Markdown wird herausgetrennt und als echtes Bild gezeigt,
  // Übersetzungs-Zusätze verschwinden, die {{cN::…}}-Lücke wird zum Strich und
  // ihre Lösung zur Rückseite. Das Vorlesen bleibt bei den Rohtexten —
  // speechTexts macht seine eigene Aufbereitung (Pause statt Lösung).
  const media = summarizeCardMedia({ front: shownFront, back: shownBack });
  const normalizedFront = cleanTerm(media.plainFront || shownFront);
  const normalizedBack = cleanTerm(media.plainBack || shownBack);
  const frontParsed = formatCloze(normalizedFront);
  const displayBack = frontParsed.clozeAnswer ?? normalizedBack;
  const frontImage = media.frontImages[0] ?? media.primaryImage;
  const backImage = media.backImages[0] ?? media.primaryImage;

  // ─── Vorlese-Sprachen je Deck (#571) ──────────────────────────────────────
  // Auch die Ordner-Runde mischt Karten aus mehreren Decks, deshalb eine
  // Zuordnung Deck → Sprachen statt einer Sprache für die ganze Sitzung. Ein
  // Fehler ist unkritisch: ohne Eintrag bleibt es bei Deutsch wie bisher.
  const [deckLangs, setDeckLangs] = useState<
    Record<string, { front: SpeechLanguage; back: SpeechLanguage }>
  >({});
  // Deck-Titel für die kleine Beschriftung auf der Karte (#609): Sobald der
  // Stapel Karten aus MEHREREN Decks mischt (globale Runde, Ordner-Runde),
  // sagt die Karte, zu welchem Deck sie gehört — Laras Bedingung dafür, dass
  // die fällige Runde über alle Decks überhaupt gebaut wird.
  const [deckTitles, setDeckTitles] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    listDecks(userId)
      .then(({ decks }) => {
        if (cancelled) return;
        const map: Record<string, { front: SpeechLanguage; back: SpeechLanguage }> = {};
        const titles: Record<string, string> = {};
        for (const d of decks) {
          map[d.id] = {
            front: toSpeechLanguage(d.speechLangFront),
            back: toSpeechLanguage(d.speechLangBack),
          };
          titles[d.id] = d.title;
        }
        setDeckLangs(map);
        setDeckTitles(titles);
      })
      .catch(() => {
        /* Ohne Zuordnung bleibt es bei Deutsch — Vorlesen muss trotzdem gehen */
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Nur bei gemischten Stapeln beschriften — im Ein-Deck-Lernen stünde sonst
  // auf jeder Karte redundant der Titel, den die Kopfzeile schon nennt.
  const multiDeck = useMemo(
    () => new Set(pool.map((c) => c.deckId)).size > 1,
    [pool]
  );
  const currentDeckTitle =
    multiDeck && current?.deckId ? deckTitles[current.deckId] : undefined;

  // Die Sprache folgt dem TEXT, nicht der Position: „Richtung tauschen"
  // (reverse) zeigt die Rückseite zuerst, dann muss auch deren Sprache zuerst
  // gesprochen werden.
  const cardLangs = current?.deckId ? deckLangs[current.deckId] : undefined;
  const frontSideLang: SpeechLanguage = reverse
    ? (cardLangs?.back ?? DEFAULT_SPEECH_LANGUAGE)
    : (cardLangs?.front ?? DEFAULT_SPEECH_LANGUAGE);
  const backSideLang: SpeechLanguage = reverse
    ? (cardLangs?.front ?? DEFAULT_SPEECH_LANGUAGE)
    : (cardLangs?.back ?? DEFAULT_SPEECH_LANGUAGE);

  // ─── Vorlesen + Auto-Abspielen (wie der App-Lernmodus) ───────────────────
  const { supported, speaking, speak, stop } = useSpeech();
  const [autoPlaying, setAutoPlaying] = useState(false);
  const [autoPlaySpeed, setAutoPlaySpeed] = useState(3);
  const spoken = current ? speechTexts(shownFront, shownBack) : null;

  // LP fürs Lernen gutschreiben — wie die App. Der Server zählt review_logs;
  // wir warten auf laufende Review-Requests, bevor earnLp aufgerufen wird.
  const awardSession = useCallback((count: number) => {
    const state = awardStateRef.current;
    return beginSessionAward(state, count, async () => {
      try {
        const maxAttempts = 3;
        const retryDelayMs = 250;

        for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs));
          }

          const pendingReviews = pendingReviewsRef.current;
          pendingReviewsRef.current = [];
          await Promise.allSettled(pendingReviews);

          // Erst NACH dem Abwarten zählen: Ob eine Bewertung endgültig
          // abgelehnt wurde (#605), steht erst fest, wenn alle Sende-Versuche
          // beantwortet sind. Beansprucht wird nur, was wirklich gespeichert
          // wurde.
          const saved = persistedReviewCount(count, unsavedRef.current);
          if (saved === 0) {
            // Nichts kam durch — es gibt nichts abzurechnen, und ein weiterer
            // Anlauf würde daran nichts ändern.
            state.finalized = true;
            break;
          }

          const res = await earnLp("session", saved);
          setEarned(res.granted);
          setEarnCapReached(res.capReached);

          if (isSessionEarnFinalized(res, saved)) {
            state.finalized = true;
            break;
          }
        }
      } catch {
        /* LP-Gutschrift ist best-effort */
      }
    });
  }, []);

  const sendReview = useCallback(
    (cardId: string, rating: ReviewRating) => {
      if (!userId) return;
      // Ausdrücklich, obwohl "flashcard" ohnehin der Server-Default ist: Jeder
      // Modus soll sagen, wer er ist. Sonst hängt die Richtigkeit dieser Zeile
      // daran, dass der Default nie geändert wird — und dieser Ablauf trägt
      // sowohl die Deck- als auch die Ordner-Lernseite.
      const reviewPromise = reviewCard(userId, cardId, rating, { mode: "flashcard" }).catch(
        (error) => {
          // Karte inzwischen gelöscht (#605): endgültig verloren — zählen und
          // am Rundenende ehrlich ausweisen. Alle anderen Fehler bleiben
          // best-effort; die Planung holt sie beim nächsten Laden nach.
          if (isCardGone(error)) {
            unsavedRef.current += 1;
            setUnsavedCount(unsavedRef.current);
          }
        }
      );
      pendingReviewsRef.current.push(reviewPromise);
    },
    [userId]
  );

  /** Zurückgehaltene Bewertung abschicken: Runde vorbei oder Ansicht verlassen. */
  const flushReview = useCallback(() => {
    const last = reviewBufferRef.current.flush();
    if (last) sendReview(last.cardId, last.rating);
  }, [sendReview]);

  useEffect(() => {
    if (done) {
      // Die letzte Karte hat kein „danach", das den Puffer freigäbe — und die
      // Abrechnung zählt gleich, also muss sie vorher raus.
      flushReview();
      void awardSession(total - startIndex);
    }
  }, [done, total, startIndex, awardSession, flushReview]);

  // ─── Verlassen ohne „Beenden"-Knopf (#608) ───────────────────────────────
  // Browser-Zurück oder ein Link unmountet die Ansicht, ohne dass quit() je
  // läuft — die zurückgehaltene Bewertung und die Runden-LP gingen verloren.
  // Der Aufräum-Effekt macht beim Unmount dasselbe wie quit(); die Wächter in
  // beginSessionAward und im Puffer-flush verhindern jede Doppel-Abrechnung,
  // wenn vorher doch der Knopf gedrückt wurde. Über den Ref sieht der
  // Unmount-Zeitpunkt immer den letzten Stand statt des ersten Renders.
  const leaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    leaveRef.current = () => {
      flushReview();
      void awardSession(
        getSessionReviewedCount(index - startIndex, pendingReviewsRef.current.length)
      );
    };
  });
  useEffect(() => () => leaveRef.current(), []);

  // Tab schließen oder neu laden: Hier können wir nur noch mit dem
  // Browser-eigenen Fenster warnen — zuverlässig nachsenden lässt sich nichts
  // mehr (Begründung in test/page.tsx). Gewarnt wird nur, solange wirklich
  // etwas zu verlieren ist: eine zurückgehaltene Bewertung oder noch nicht
  // abgerechnete Runden-LP.
  useEffect(() => {
    if (done) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasUnsaved =
        reviewBufferRef.current.hasPending() ||
        (!awardStateRef.current.finalized && index - startIndex > 0);
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [done, index, startIndex]);

  // ─── Merken, wo eine unterbrochene Runde stand (Weitermachen) ────────────
  // Bei jedem Kartenwechsel geschrieben statt beim Verlassen: Ein Tab lässt
  // sich schließen, ohne dass irgendein Aufräum-Code läuft. Das Rundenende
  // löscht den Eintrag — eine fertige Runde hat nichts fortzusetzen.
  useEffect(() => {
    if (!progressDeckId || !progressSource || total === 0) return;
    if (done) {
      // Auch im Konto löschen (#610) — sonst böte das andere Gerät eine Runde
      // an, die hier längst fertig ist.
      void clearProgressEverywhere(progressDeckId, "flashcards");
      return;
    }
    const card = cards[index];
    if (!card) return;
    saveSessionProgress(progressDeckId, "flashcards", {
      index,
      cardId: card.id,
      source: progressSource,
      reverse,
      total,
    });
  }, [progressDeckId, progressSource, cards, index, done, total, reverse]);

  // Beim Verlassen der Runde den Stand ins Konto schreiben (#610). Bewusst
  // NICHT bei jedem Kartenwechsel: Das wäre eine Anfrage je Karte. Der Ref
  // trägt den jeweils aktuellen Stand, damit der Effekt selbst nur einmal
  // eingehängt werden muss und beim Abbau den letzten Stand sieht.
  const accountPushRef = useRef<SessionProgress | null>(null);
  accountPushRef.current =
    !done && progressDeckId && progressSource && cards[index]
      ? {
          index,
          cardId: cards[index]!.id,
          source: progressSource,
          reverse,
          total,
        }
      : null;
  useEffect(() => {
    if (!progressDeckId) return;
    const push = () => {
      const pending = accountPushRef.current;
      if (pending) void pushProgressToAccount(progressDeckId, "flashcards", pending);
    };
    // Ein geschlossener Tab läuft ohne Aufräum-Code — das Verstecken der Seite
    // ist der letzte Moment, in dem eine Anfrage noch verlässlich rausgeht.
    const onHide = () => {
      if (document.visibilityState === "hidden") push();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      push();
    };
  }, [progressDeckId]);

  // useCallback statt schlichter Funktion, weil der Auto-Abspielen-Timer sie
  // aus einem Effekt heraus aufruft.
  const rate = useCallback(
    (rating: ReviewRating) => {
      const card = cards[index];
      if (!card || !userId) return;
      if (rating === "good" || rating === "easy") setCorrect((n) => n + 1);
      else setNotKnown((prev) => [...prev, card]);
      // Die vorige Karte ist endgültig hinter uns — ihre Bewertung darf raus;
      // die neue bleibt im Puffer, bis auch sie hinter uns liegt.
      const previous = reviewBufferRef.current.rate({ cardId: card.id, rating });
      if (previous) sendReview(previous.cardId, previous.rating);
      setHistory((h) => [...h, { index, rating }]);
      setFlipped(false);
      window.setTimeout(() => setIndex((i) => i + 1), 160);
      // Fokus zurück auf die Karte (#610). Sonst bleibt er auf dem eben
      // geklickten Bewertungs-Knopf stehen — und die Leertaste, mit der man
      // die nächste Karte umdrehen will, drückt stattdessen wieder denselben
      // Knopf und bewertet die neue Karte ungesehen.
      cardRef.current?.focus();
    },
    [cards, index, userId, sendReview]
  );

  // Tasten 1–4 bewerten wie die vier Knöpfe — aber erst bei umgedrehter Karte
  // (#610). Der Horcher hängt am Fenster, damit er auch greift, wenn der Fokus
  // gerade nirgendwo Bestimmtem sitzt.
  useEffect(() => {
    if (done || total === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const ratingIndex = ratingKeyIndex(
        {
          key: e.key,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          altKey: e.altKey,
          targetTag: target?.tagName,
          targetIsEditable: target?.isContentEditable,
        },
        flipped
      );
      if (ratingIndex === null) return;
      const rating = RATINGS[ratingIndex];
      if (!rating) return;
      e.preventDefault();
      rate(rating.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flipped, rate, done, total]);

  // Zurück zur vorigen Karte: die noch ungesendete Bewertung wird verworfen
  // (Rückgängig), Zähler und Wiederholungs-Stapel drehen zurück. Nur bis zur
  // ersten Karte DIESER Sitzung — beim Weitermachen bleiben die Karten der
  // letzten Sitzung gesperrt, ihre Bewertungen sind längst beim Server.
  function goBack() {
    const last = history[history.length - 1];
    if (!last) return;
    reviewBufferRef.current.back();
    if (last.rating === "good" || last.rating === "easy") {
      setCorrect((n) => Math.max(0, n - 1));
    } else {
      setNotKnown((prev) => prev.slice(0, -1));
    }
    setHistory((h) => h.slice(0, -1));
    setFlipped(false);
    setIndex(last.index);
  }

  // Stern-Markieren mitten in der Runde — sofort sichtbar (optimistisch),
  // bei Serverfehler wieder zurückgenommen.
  function toggleStar() {
    const card = cards[index];
    if (!card) return;
    const next = !(starredMap[card.id] ?? false);
    setStarredMap((m) => ({ ...m, [card.id]: next }));
    updateCard(card.id, { starred: next }).catch(() => {
      setStarredMap((m) => ({ ...m, [card.id]: !next }));
    });
  }

  // Richtung tauschen mitten in der Runde — die Karte dreht auf die neue
  // Vorderseite zurück, damit sofort in der neuen Richtung gefragt wird.
  function toggleReverse() {
    setReverse((r) => !r);
    setFlipped(false);
    stop();
  }

  // Beim Kartenwechsel verstummen — wie die App. Läuft Auto-Abspielen, spricht
  // der Effekt darunter gleich danach die neue Karte.
  useEffect(() => {
    stop();
  }, [index, stop]);

  // Runde fertig → Auto-Abspielen beenden.
  useEffect(() => {
    if (done && autoPlaying) {
      setAutoPlaying(false);
      stop();
    }
  }, [done, autoPlaying, stop]);

  // Der Takt des Auto-Abspielens: nach der Wartezeit erst umdrehen, dann mit
  // „Gut" bewerten und weiterblättern — exakt der App-Ablauf.
  useEffect(() => {
    if (!autoPlaying || done || total === 0) return;
    const timer = window.setTimeout(() => {
      if (!flipped) setFlipped(true);
      else rate("good");
    }, autoPlaySpeed * 1000);
    return () => window.clearTimeout(timer);
  }, [autoPlaying, flipped, index, autoPlaySpeed, done, total, rate]);

  // Beim Auto-Abspielen jede neu sichtbare Seite vorlesen.
  useEffect(() => {
    if (!autoPlaying) return;
    const card = cards[index];
    if (!card) return;
    const texts = speechTexts(reverse ? card.back : card.front, reverse ? card.front : card.back);
    speak(flipped ? texts.back : texts.front, flipped ? backSideLang : frontSideLang);
    return () => stop();
  }, [
    autoPlaying,
    flipped,
    index,
    cards,
    reverse,
    speak,
    stop,
    frontSideLang,
    backSideLang,
  ]);

  function toggleSpeak() {
    if (!spoken) return;
    if (speaking) {
      stop();
      return;
    }
    speak(flipped ? spoken.back : spoken.front, flipped ? backSideLang : frontSideLang);
  }

  function toggleAutoPlay() {
    if (autoPlaying) {
      setAutoPlaying(false);
      stop();
    } else {
      setAutoPlaying(true);
    }
  }

  function cycleSpeed() {
    setAutoPlaySpeed((s) => {
      const idx = AUTO_PLAY_SPEEDS.indexOf(s);
      return AUTO_PLAY_SPEEDS[(idx + 1) % AUTO_PLAY_SPEEDS.length] ?? 3;
    });
  }

  async function startRound(next: Card[]) {
    // Eine neue Runde darf keine Bewertung der alten mitschleppen.
    flushReview();
    await awardSession(total - startIndex);
    awardStateRef.current.finalized = false;
    pendingReviewsRef.current = [];
    unsavedRef.current = 0;
    setUnsavedCount(0);
    setEarned(null);
    setEarnCapReached(false);
    setCards(next);
    setNotKnown([]);
    setIndex(0);
    // Folge-Runden („Nur die nicht gewussten" / „Alle nochmal") beginnen
    // wieder ganz vorn — der Weitermachen-Einstieg galt nur der ersten.
    setStartIndex(0);
    setHistory([]);
    setFlipped(false);
    setCorrect(0);
  }

  async function quit() {
    // Sofort verstummen — die LP-Sicherung darunter darf einen Moment dauern,
    // die Stimme soll aber nicht so lange weiterreden.
    setAutoPlaying(false);
    stop();
    // Auch die zurückgehaltene Bewertung gehört noch zu dieser Sitzung.
    flushReview();
    // Beim frühen Beenden noch die LP der bisher gelernten Karten sichern —
    // beim Weitermachen zählen nur die ab dem Einstieg gelernten.
    const reviewedCount = getSessionReviewedCount(
      index - startIndex,
      pendingReviewsRef.current.length
    );
    await awardSession(reviewedCount);
    router.push(backHref);
  }

  if (done) {
    // Beim Weitermachen zählt die Auswertung nur die in DIESER Runde
    // gelernten Karten — die übersprungenen wurden letztes Mal bewertet.
    const studied = total - startIndex;
    return (
      <div className="study-wrap">
        <div className="study-done">
          {/* Immer die grüne Trophäe im grünen Kreis (App-Kanon, #595 Teil C):
              eine geschaffte Runde ist nie ein Misserfolg — wie gut es lief,
              sagt der Text. */}
          <div className="big big--ring" aria-hidden>
            <Trophy size={42} />
          </div>
          <h2 className="h2">Runde geschafft{displayName ? `, ${displayName}` : ""}!</h2>
          <p className="lead">
            Du hast {studied} {studied === 1 ? "Karte" : "Karten"} wiederholt — {correct} davon
            sicher gewusst.
          </p>
          {/* Ehrliche Zeile (#605): Zahlen oben zeigen die ganze Runde (Laras
              Variante A), diese Zeile sagt, was davon der Server nie
              gespeichert hat, weil die Karten inzwischen gelöscht wurden. */}
          {unsavedCount > 0 && (
            <p className="study-unsaved">{unsavedReviewsNotice(unsavedCount)}</p>
          )}
          {earned !== null && earned > 0 && (
            <span className="lp-pill">
              <Zap size={15} /> +{earned} Lernpunkte
            </span>
          )}
          {earned === 0 && earnCapReached && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Heutiges Lernpunkte-Limit erreicht — morgen gibt es wieder welche.
            </p>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            {notKnown.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => startRound(notKnown)}
              >
                Nur die nicht gewussten ({notKnown.length})
              </button>
            )}
            <button
              type="button"
              className={notKnown.length > 0 ? "btn btn-ghost" : "btn btn-primary"}
              onClick={() => startRound(pool)}
            >
              Alle nochmal
            </button>
            <button type="button" className="btn btn-ghost" onClick={quit}>
              {backLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const starred = current ? starredMap[current.id] ?? false : false;

  return (
    <>
    <div className="study-wrap">
      <div className="study-top">
        <button
          type="button"
          className="crumb"
          style={{ margin: 0, background: "none", border: "none", cursor: "pointer" }}
          onClick={quit}
        >
          <X size={16} /> Beenden
        </button>
        {/* Wie App und Lückentext (#595): das Umdrehen zählt schon als halber
            Schritt, der 2-%-Sockel zeigt den Rundenstart, 100 % werden grün. */}
        <div className="progress">
          <i
            style={{
              width: `${Math.max(((index + (flipped ? 1 : 0)) / total) * 100, 2)}%`,
              ...(index + (flipped ? 1 : 0) >= total ? { background: "var(--green)" } : {}),
            }}
          />
        </div>
        <span className="muted" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          Karte {index + 1} von {total}
        </span>
      </div>

      {/* Rot/grün-Zähler außen, Richtung + Auto in der Mitte — wie die App. */}
      <div className="learn-meta">
        <span className="count-pill count-pill--again" aria-label="Nicht gewusst in dieser Runde">
          {notKnown.length}
        </span>
        <span className="learn-meta__mid">
          <button
            type="button"
            className="autoplay-pill"
            onClick={toggleReverse}
            aria-pressed={reverse}
            aria-label="Abgefragte Richtung tauschen"
          >
            <Repeat size={13} />
            {reverse ? "Rückseite zuerst" : "Vorderseite zuerst"}
          </button>
          {supported && (
            <>
              <button
                type="button"
                className={`autoplay-pill${autoPlaying ? " is-on" : ""}`}
                onClick={toggleAutoPlay}
                aria-pressed={autoPlaying}
                aria-label={
                  autoPlaying ? "Automatisches Abspielen anhalten" : "Automatisch abspielen"
                }
              >
                {autoPlaying ? <Pause size={13} /> : <Play size={13} />}
                Auto
              </button>
              {autoPlaying && (
                <button
                  type="button"
                  className="autoplay-pill"
                  onClick={cycleSpeed}
                  aria-label={`Wartezeit ${autoPlaySpeed} Sekunden — tippen zum Wechseln`}
                >
                  <Timer size={13} />
                  {autoPlaySpeed}s
                </button>
              )}
            </>
          )}
        </span>
        <span className="count-pill count-pill--good" aria-label="Gewusst in dieser Runde">
          {correct}
        </span>
      </div>

      <div
        ref={cardRef}
        className={`flip study-card${flipped ? " is-flipped" : ""}${
          frontImage || backImage ? " flip--media" : ""
        }`}
        role="button"
        tabIndex={0}
        aria-label="Karte umdrehen"
        onClick={() => setFlipped((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((v) => !v);
          }
        }}
      >
        <div className="flip__inner">
          <div className="flip__face flip__face--front">
            {currentDeckTitle && <span className="flip__deck">{currentDeckTitle}</span>}
            <span className="flip__label">Frage</span>
            {frontImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="flip__img" src={frontImage.url} alt={frontImage.alt} />
            )}
            <span className="flip__q">
              {frontParsed.display || frontImage?.alt || "Bildkarte"}
            </span>
            <span className="flip__hint">
              {coarsePointer ? "Tippen zum Umdrehen" : "Klicken zum Umdrehen"}
            </span>
          </div>
          <div className="flip__face flip__face--back">
            {currentDeckTitle && <span className="flip__deck">{currentDeckTitle}</span>}
            <span className="flip__label">Antwort</span>
            {backImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="flip__img" src={backImage.url} alt={backImage.alt} />
            )}
            <span className="flip__q">{displayBack || backImage?.alt || "—"}</span>
            <span className="flip__hint">Wie gut wusstest du es?</span>
          </div>
        </div>
        <button
          type="button"
          className={`star-btn${starred ? " is-starred" : ""}`}
          aria-label={starred ? "Markierung entfernen" : "Karte markieren"}
          aria-pressed={starred}
          onClick={(e) => {
            e.stopPropagation();
            toggleStar();
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Star size={18} />
        </button>
        <button
          type="button"
          className="edit-btn"
          aria-label="Karte bearbeiten"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Pencil size={17} />
        </button>
        {supported && (
          <button
            type="button"
            className={`speak-btn${speaking ? " is-speaking" : ""}`}
            aria-label={speaking ? "Vorlesen stoppen" : "Vorlesen"}
            onClick={(e) => {
              e.stopPropagation();
              toggleSpeak();
            }}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Volume2 size={18} />
          </button>
        )}
      </div>

      {/* Bewertungs-Knöpfe immer sichtbar — wie die App (Laras Wahl). Die
          Zifferntaste steht im Tooltip und in aria-keyshortcuts: am Laptop
          entdeckbar, ohne die Knöpfe am Handy mit sinnlosen Zahlen zu füllen. */}
      <div className="rating-row">
        {RATINGS.map((r, i) => (
          <button
            key={r.key}
            type="button"
            className={`rating ${r.cls}`}
            title={`${r.label} (Taste ${i + 1})`}
            aria-keyshortcuts={String(i + 1)}
            onClick={() => rate(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="learn-bottom">
        <button
          type="button"
          className="cl-back"
          onClick={goBack}
          disabled={history.length === 0}
          aria-label="Vorherige Karte — letzte Bewertung rückgängig"
        >
          <ArrowLeft size={22} />
        </button>
      </div>
    </div>
    {editing && current && (
      <CardEditor
        initial={current}
        onClose={() => setEditing(false)}
        onSubmit={async (front, back) => {
          const { card: updated } = await updateCard(current.id, { front, back });
          // Nur die editierte Karte patchen (#610) — ein Neuladen der Runde
          // würde Fortschritt, Index und Bewertungen dieser Sitzung zerstören.
          setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
          setEditing(false);
        }}
      />
    )}
    </>
  );
}
