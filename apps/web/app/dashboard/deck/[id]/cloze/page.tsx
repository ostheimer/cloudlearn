"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { listCardsInDeck, reviewCard, earnLp, isApiError, type Card } from "@/lib/api";
import { isAnswerCorrect, isCaseOnlyMismatch } from "@/lib/answerCheck";
import { buildPrompt, hasTypeable } from "@/lib/cloze-prompt";
import { createReviewSendBuffer } from "@/lib/review-send-buffer";
import {
  isCardGone,
  persistedReviewCount,
  unsavedReviewsNotice,
} from "@/lib/unsaved-reviews";
import { useDisplayName } from "@/lib/use-display-name";
import { useWobblyIds } from "@/lib/use-wobbly-ids";
import { filterBySource, type CardSource } from "@/lib/card-source";
import { loadSetup, resolveSource, saveSetup } from "@/lib/setup-memory";
import { CardSourcePicker } from "@/components/app/card-source-picker";
import {
  beginSessionAward,
  getSessionReviewedCount,
  isSessionEarnFinalized,
  type SessionAwardState,
} from "@/lib/learn-session-lp";
import {
  clearSessionProgress,
  isProgressUsable,
  loadSessionProgress,
  saveSessionProgress,
  type SessionProgress,
  type StoredCardResult,
} from "@/lib/session-progress";
import {
  ArrowLeft,
  X,
  Check,
  CheckCircle,
  Trophy,
  Pencil,
  Zap,
  AlertTriangle,
} from "@/components/icons";

type Result = { input: string; correct: boolean; overridden: boolean };

export default function ClozePage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const router = useRouter();
  const { userId } = useAuth();
  const displayName = useDisplayName();

  const [allCards, setAllCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Im Setup-Menü gewählte Einstellungen
  const [strict, setStrict] = useState(true);
  const [reverse, setReverse] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const { ids: wobblyIds, settled: wobblySettled } = useWobblyIds(deckId);

  const [phase, setPhase] = useState<"setup" | "play" | "summary">("setup");
  const [round, setRound] = useState<Card[]>([]);
  const [idx, setIdx] = useState(0);
  // Untergrenze für den Zurück-Pfeil. Beim Weitermachen wurden die Karten vor
  // der Einstiegskarte letztes Mal beantwortet und bewertet — zurückblättern
  // würde sie ein zweites Mal bewerten.
  const [floor, setFloor] = useState(0);
  const [input, setInput] = useState("");
  // Ein Ergebnis-Slot je Karte (null = noch nicht beantwortet), damit der
  // Zurück-Knopf eine frühere Karte in ihrem beantworteten Zustand zeigt.
  const [results, setResults] = useState<(Result | null)[]>([]);
  // Wo eine frühere Runde dieses Decks stand, falls gemerkt. Wird nur
  // ANGEBOTEN, nie angewendet.
  const [saved, setSaved] = useState<SessionProgress | null>(null);

  const [earned, setEarned] = useState<number | null>(null);
  const [earnCapReached, setEarnCapReached] = useState(false);
  const awardStateRef = useRef<SessionAwardState>({ finalized: false, inFlight: null });
  const pendingReviewsRef = useRef<Promise<unknown>[]>([]);
  // Endgültig verlorene Bewertungen (#605): Ref für die Abrechnung, State für
  // die Ergebnis-Zeile — immer zusammen fortgeschrieben.
  const unsavedRef = useRef(0);
  const [unsavedCount, setUnsavedCount] = useState(0);
  // Ein-Schritt-Puffer (#567): hält die jüngste Bewertung zurück, damit
  // „Trotzdem als richtig zählen" sie ersetzen kann statt doppelt zu melden.
  const reviewBufferRef = useRef(createReviewSendBuffer());
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards } = await listCardsInDeck(deckId);
      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      setAllCards(cards.filter((c) => c.type !== "occlusion" && hasTypeable(c)));
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  // Gemerkten Lernstand einmal je Seite lesen; das Angebot im Setup erscheint
  // nur, solange er zum Stapel der aktuellen Auswahl passt.
  useEffect(() => {
    if (!deckId) return;
    setSaved(loadSessionProgress(deckId, "cloze"));
  }, [deckId]);

  // #610: Die Schalter der letzten Runde sofort beim Öffnen vorbelegen — da
  // steht noch der Spinner, es kann also keine eigene Wahl überschrieben
  // werden. Die Kartenquelle folgt im Effekt darunter, sobald feststeht, ob
  // sie heute wieder Karten hätte.
  useEffect(() => {
    const stored = loadSetup(deckId, "cloze");
    if (stored?.strict !== undefined) setStrict(stored.strict);
    if (stored?.reverse !== undefined) setReverse(stored.reverse);
  }, [deckId]);

  const sourceRestoredRef = useRef(false);
  const sourceTouchedRef = useRef(false);
  useEffect(() => {
    if (sourceRestoredRef.current || sourceTouchedRef.current) return;
    if (phase !== "setup" || loading || !wobblySettled) return;
    sourceRestoredRef.current = true;
    const wanted = resolveSource(loadSetup(deckId, "cloze")?.source, {
      starred: allCards.filter((c) => c.starred).length,
      wobbly: allCards.filter((c) => wobblyIds.has(c.id)).length,
    });
    if (wanted) setSource(wanted);
  }, [deckId, phase, loading, wobblySettled, allCards, wobblyIds]);

  const studyPool = filterBySource(allCards, source, wobblyIds);
  const canResume =
    saved !== null &&
    isProgressUsable(
      saved,
      studyPool.map((c) => c.id),
      source
    );

  const current = round[idx];
  const parsed = current ? buildPrompt(current, reverse) : null;
  const result = results[idx] ?? null;
  const revealed = result !== null;
  const wasCorrect = result ? result.correct || result.overridden : false;
  // Gelbe „Fast"-Stufe (#610, Laras Entscheidung): Die Antwort scheitert NUR
  // an der Groß-/Kleinschreibung. Sie zählt nicht automatisch als richtig —
  // der „Trotzdem als richtig zählen"-Knopf darunter entscheidet.
  const nearMiss =
    revealed && !wasCorrect && parsed
      ? isCaseOnlyMismatch(result?.input ?? "", parsed.answer)
      : false;

  // Eingabefeld bei neuer, unbeantworteter Karte fokussieren.
  useEffect(() => {
    if (phase === "play" && !revealed) inputRef.current?.focus();
  }, [phase, idx, revealed]);

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

          // Erst NACH dem Abwarten zählen (#605): Beansprucht wird nur, was
          // der Server wirklich gespeichert hat — abgelehnte Bewertungen
          // gelöschter Karten gehen ab.
          const saved = persistedReviewCount(count, unsavedRef.current);
          if (saved === 0) {
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

  const startRound = useCallback(async (
    cards: Card[],
    startAt = 0,
    storedResults?: Record<string, StoredCardResult>,
  ) => {
    // Eine neue Runde darf keine Bewertung der alten mitschleppen: Die Karte
    // ist vorbei, ihre Bewertung gehört noch zur vorigen Abrechnung.
    flushReview();
    await awardSession(round.length);
    awardStateRef.current = { finalized: false, inFlight: null };
    pendingReviewsRef.current = [];
    unsavedRef.current = 0;
    setUnsavedCount(0);
    setEarned(null);
    setEarnCapReached(false);
    // `startAt` setzt eine unterbrochene Runde fort (session-progress.ts).
    // Die Untergrenze wandert mit: Die übersprungenen Karten wurden letztes
    // Mal beantwortet und bewertet — der Zurück-Pfeil darf nicht in sie
    // hineinlaufen und eine zweite Bewertung einsammeln.
    const from = Math.min(Math.max(startAt, 0), Math.max(cards.length - 1, 0));
    // Die Ergebnisse der letzten Sitzung wieder einfüllen, damit die Auswertung
    // die ganze Runde zählt und alte falsche Karten wieder im Wiederhol-Stapel
    // landen. Nur unterhalb der Untergrenze: ab der Einstiegskarte wird neu
    // beantwortet. Die Eingabe von damals ist nicht gespeichert (leer) —
    // sichtbar wird sie nie, der Zurück-Pfeil endet an der Untergrenze.
    const initialResults: (Result | null)[] = new Array(cards.length).fill(null);
    if (storedResults) {
      for (let i = 0; i < from; i++) {
        const skippedCard = cards[i];
        const stored = skippedCard ? storedResults[skippedCard.id] : undefined;
        if (stored) initialResults[i] = { input: "", ...stored };
      }
    }
    setRound(cards);
    setResults(initialResults);
    setIdx(from);
    setFloor(from);
    setInput("");
    setPhase("play");
  }, [awardSession, round.length]);

  const setResultAt = (i: number, v: Result | null) =>
    setResults((prev) => prev.map((r, j) => (j === i ? v : r)));

  function sendReview(cardId: string, rating: "good" | "again") {
    if (!userId) return;
    const reviewPromise = reviewCard(userId, cardId, rating, { mode: "cloze" }).catch((error) => {
      // Karte inzwischen gelöscht (#605): endgültig verloren — zählen und am
      // Rundenende ehrlich ausweisen. Alles andere bleibt best-effort.
      if (isCardGone(error)) {
        unsavedRef.current += 1;
        setUnsavedCount(unsavedRef.current);
      }
    });
    pendingReviewsRef.current.push(reviewPromise);
  }

  // Bewertungen einen Schritt zurückhalten statt sofort schicken (#567,
  // App-Muster): Nur so kann „Trotzdem als richtig zählen" die Bewertung der
  // Karte auf dem Schirm noch ERSETZEN. Ging sie sofort raus, bliebe der
  // Fehlversuch stehen und das „gut" käme obendrauf — die Karte gälte als
  // gescheitert UND bestanden und fiele im Lernplan zurück.
  function review(cardId: string, rating: "good" | "again") {
    if (!userId) return;
    // Die vorige Karte ist endgültig hinter uns — ihre Bewertung darf raus.
    const previous = reviewBufferRef.current.rate({ cardId, rating });
    if (previous) sendReview(previous.cardId, previous.rating as "good" | "again");
  }

  /** Zurückgehaltene Bewertung abschicken: Runde vorbei oder Seite verlassen. */
  function flushReview() {
    const last = reviewBufferRef.current.flush();
    if (last) sendReview(last.cardId, last.rating as "good" | "again");
  }

  function check() {
    if (revealed || !current || !parsed) return;
    const correct = isAnswerCorrect(input, parsed.answer, { strict });
    setResultAt(idx, { input, correct, overridden: false });
    review(current.id, correct ? "good" : "again");
  }

  // „Weiß ich nicht": Lösung zeigen, als falsch werten (kommt in die Wiederholung).
  function dontKnow() {
    if (revealed || !current) return;
    setResultAt(idx, { input, correct: false, overridden: false });
    review(current.id, "again");
  }

  // Selbstbewertung: eine als falsch markierte Antwort doch zählen lassen.
  function override() {
    if (!result || wasCorrect || !current) return;
    setResultAt(idx, { ...result, overridden: true });
    // Solange die Bewertung dieser Karte noch bei uns liegt, wird sie ersetzt —
    // die Karte bekommt dann genau ein „gut" und keinen Rückfall. Nur beim
    // rückwirkenden Übersteuern (zurückgeblättert, Bewertung längst beim
    // Server) bleibt eine korrigierende zweite Bewertung als einziger Weg.
    if (!reviewBufferRef.current.amend(current.id, "good")) {
      sendReview(current.id, "good");
    }
  }

  function next() {
    if (idx + 1 >= round.length) {
      // Die letzte Karte hat kein „danach", das den Puffer freigäbe — und die
      // Abrechnung zählt gleich, also muss sie vorher raus.
      flushReview();
      // Lernpunkte gibt es nur für DIESE Sitzung: Die Slots unterhalb der
      // Untergrenze sind wiederhergestellte Ergebnisse der letzten Sitzung —
      // deren Punkte wurden damals schon abgerechnet.
      const answered = results.slice(floor).filter(Boolean).length;
      const reviewedCount = getSessionReviewedCount(
        answered,
        pendingReviewsRef.current.length,
      );
      void awardSession(reviewedCount);
      setPhase("summary");
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
  }

  function back() {
    if (idx <= floor) return;
    setIdx((i) => i - 1);
    setInput("");
  }

  // ─── Merken, wo eine unterbrochene Runde stand (Weitermachen) ────────────
  // Bei jedem Kartenwechsel geschrieben statt beim Verlassen: Ein Tab lässt
  // sich schließen, ohne dass irgendein Aufräum-Code läuft. Die Auswertung
  // löscht den Eintrag — eine fertige Runde hat nichts fortzusetzen.
  useEffect(() => {
    if (!deckId || round.length === 0) return;
    if (phase === "summary") {
      clearSessionProgress(deckId, "cloze");
      return;
    }
    if (phase !== "play") return;
    const card = round[idx];
    if (!card) return;
    // Die Ergebnisse der beantworteten Karten wandern mit in den Merker —
    // nach Karten-Id, nicht nach Position, damit sie ein verändertes Deck
    // überleben. Wiederhergestellte Ergebnisse einer noch früheren Sitzung
    // stehen bereits in `results` und bleiben so über mehrere Unterbrechungen
    // hinweg erhalten.
    const answered: Record<string, StoredCardResult> = {};
    round.forEach((roundCard, i) => {
      const r = results[i];
      if (r) answered[roundCard.id] = { correct: r.correct, overridden: r.overridden };
    });
    saveSessionProgress(deckId, "cloze", {
      index: idx,
      cardId: card.id,
      source,
      reverse,
      total: round.length,
      ...(Object.keys(answered).length > 0 ? { results: answered } : {}),
    });
  }, [deckId, phase, round, idx, source, reverse, results]);

  async function quit() {
    // Auch die zurückgehaltene Bewertung gehört noch zu dieser Sitzung.
    flushReview();
    // Wie in next(): wiederhergestellte Ergebnisse zählen nicht als neue Reviews.
    const answered = results.slice(floor).filter(Boolean).length;
    const reviewedCount = getSessionReviewedCount(
      answered,
      pendingReviewsRef.current.length,
    );
    await awardSession(reviewedCount);
    router.push(`/dashboard/deck/${deckId}`);
  }

  // ─── Verlassen ohne „Beenden"-Knopf (#608) ───────────────────────────────
  // Browser-Zurück oder ein Link unmountet die Seite, ohne dass quit() je
  // läuft — die zurückgehaltene Bewertung und die Runden-LP gingen verloren.
  // Der Aufräum-Effekt macht beim Unmount dasselbe wie quit(); die Wächter in
  // beginSessionAward und im Puffer-flush verhindern jede Doppel-Abrechnung.
  // Über den Ref sieht der Unmount-Zeitpunkt immer den letzten Stand.
  const leaveRef = useRef<() => void>(() => {});
  useEffect(() => {
    leaveRef.current = () => {
      flushReview();
      const answered = results.slice(floor).filter(Boolean).length;
      void awardSession(
        getSessionReviewedCount(answered, pendingReviewsRef.current.length),
      );
    };
  });
  useEffect(() => () => leaveRef.current(), []);

  // Tab schließen oder neu laden: Hier können wir nur noch mit dem
  // Browser-eigenen Fenster warnen — zuverlässig nachsenden lässt sich nichts
  // mehr (Begründung in test/page.tsx). Die Runde selbst überlebt über den
  // Weitermachen-Merker; verloren gingen die zurückgehaltene Bewertung und
  // die noch nicht abgerechneten Runden-LP — nur dann wird gewarnt.
  useEffect(() => {
    if (phase !== "play") return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      const answered = results.slice(floor).filter(Boolean).length;
      const hasUnsaved =
        reviewBufferRef.current.hasPending() ||
        (!awardStateRef.current.finalized && answered > 0);
      if (!hasUnsaved) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [phase, results, floor]);

  if (loading) return <div className="spinner" />;

  if (error) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <AlertTriangle size={30} />
        </div>
        <h3>Konnte nicht laden</h3>
        <p>{error}</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  if (allCards.length === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <Pencil size={30} />
        </div>
        <h3>Nichts zum Eintippen</h3>
        <p>Dieses Deck hat keine Karten, bei denen man etwas eintippen kann.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  // ---------- Setup ----------
  if (phase === "setup") {
    const leftSide = reverse ? "Rückseite" : "Vorderseite";
    const rightSide = reverse ? "Vorderseite" : "Rückseite";
    return (
      <div className="study-wrap">
        <Link href={`/dashboard/deck/${deckId}`} className="crumb">
          <ArrowLeft size={16} /> Zurück zum Deck
        </Link>

        <div className="cl-intro">
          <span className="cl-intro__ic" aria-hidden>
            <Pencil size={30} />
          </span>
          <h1 className="h2">Lückentext</h1>
          <p className="muted">Antwort eintippen</p>
        </div>

        <div className="cl-optcard">
          <div className="cl-row">
            <div>
              <div className="cl-row__t">Genau prüfen</div>
              <div className="cl-row__s">
                {strict
                  ? "Groß/klein und Akzente zählen"
                  : "Verzeiht Groß/klein, Akzente, kleine Tippfehler"}
              </div>
            </div>
            <button
              type="button"
              className={`cl-switch${strict ? " on" : ""}`}
              role="switch"
              aria-checked={strict}
              aria-label="Genau prüfen"
              onClick={() => setStrict((s) => !s)}
            >
              <i />
            </button>
          </div>
        </div>

        <button type="button" className="cl-dir" onClick={() => setReverse((r) => !r)}>
          <div className="cl-dir__lbl">Abgefragte Richtung</div>
          <div className="cl-dir__row">
            <b>{leftSide}</b>
            <span className="cl-dir__arrow" aria-hidden>
              <ArrowLeft size={20} style={{ transform: "rotate(180deg)" }} />
            </span>
            <b>{rightSide}</b>
          </div>
          <div className="cl-dir__hint">Richtung tauschen</div>
        </button>

        <CardSourcePicker
          value={source}
          onChange={(next) => {
            // Eigene Wahl schlägt die Vorbelegung — auch wenn die
            // Wackelkandidaten erst danach eintreffen (#610).
            sourceTouchedRef.current = true;
            setSource(next);
          }}
          allCount={allCards.length}
          starredCount={allCards.filter((c) => c.starred).length}
          wobblyCount={allCards.filter((c) => wobblyIds.has(c.id)).length}
        />

        {/* Weitermachen — nur solange eine unterbrochene Runde noch passt */}
        {canResume && saved && (
          <button
            type="button"
            className="btn btn-primary btn-lg btn-block btn-resume"
            onClick={() => {
              // Die unterbrochene Runde lief in einer bestimmten Richtung —
              // die fortgesetzten Karten werden genauso herum abgefragt wie
              // die davor.
              setReverse(saved.reverse);
              // Beim Start die Wahl für dieses Deck merken (#610) — mit der
              // Richtung, in der die fortgesetzte Runde wirklich läuft.
              saveSetup(deckId, "cloze", { strict, reverse: saved.reverse, source });
              void startRound(studyPool, saved.index, saved.results);
            }}
          >
            Weitermachen
            <small>
              Karte {saved.index + 1} von {studyPool.length}
            </small>
          </button>
        )}

        {/* Starten — wird zur Zweitwahl, sobald ein Weitermachen angeboten wird */}
        <button
          type="button"
          className={`btn ${canResume ? "btn-ghost" : "btn-primary"} btn-lg btn-block`}
          onClick={() => {
            // Beim Start die Wahl für dieses Deck merken (#610).
            saveSetup(deckId, "cloze", { strict, reverse, source });
            void startRound(studyPool);
          }}
        >
          {canResume ? "Von vorne beginnen" : "Starten"}
        </button>
      </div>
    );
  }

  // ---------- Auswertung ----------
  if (phase === "summary") {
    // Nach einem Weitermachen zählt die Auswertung nur die in DIESER Runde
    // beantworteten Karten (ab der Untergrenze) — die übersprungenen wurden
    // letztes Mal bewertet und ausgewertet.
    // Zählt Karten mit Ergebnis: nach einem Weitermachen sind das die dieser
    // Sitzung plus die aus dem Merker wiederhergestellten („11 von 12"). Bei
    // einem Merker von vor dem Ergebnisse-Merken fehlen die alten — dann zählt
    // ehrlich nur diese Sitzung.
    const total = results.filter(Boolean).length;
    const correct = results.filter((r) => r && (r.correct || r.overridden)).length;
    const wrong = round.filter((_, i) => {
      const r = results[i];
      return r != null && !(r.correct || r.overridden);
    });
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const allRight = wrong.length === 0;
    return (
      <div className="study-wrap">
        <div className="study-done">
          {/* Immer die grüne Trophäe im grünen Kreis (App-Kanon, #595 Teil C):
              eine geschaffte Runde ist nie ein Misserfolg — die Bewertung trägt
              die Prozentzahl. */}
          <div className="big big--ring" aria-hidden>
            <Trophy size={42} />
          </div>
          <div style={{ fontSize: "2.6rem", fontWeight: 800, letterSpacing: "-0.02em" }}>
            {pct}%
          </div>
          <p className="lead" style={{ margin: 0 }}>
            {correct} von {total} richtig
          </p>
          {allRight ? (
            <p style={{ margin: 0, color: "var(--green)", fontWeight: 700 }}>
              Alles richtig — stark{displayName ? `, ${displayName}` : ""}!
            </p>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {wrong.length} {wrong.length === 1 ? "Karte" : "Karten"} noch offen.
            </p>
          )}
          {/* Ehrliche Zeile (#605): was der Server nie gespeichert hat, weil
              die Karten inzwischen gelöscht wurden. */}
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
          <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 320 }}>
            {!allRight && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => startRound(wrong)}
              >
                Nur die nicht gewussten ({wrong.length})
              </button>
            )}
            <button
              type="button"
              className={`btn btn-block ${allRight ? "btn-primary" : "btn-ghost"}`}
              onClick={() => startRound(filterBySource(allCards, source, wobblyIds))}
            >
              Alle nochmal
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-block"
              style={{ border: "none", boxShadow: "none" }}
              onClick={() => setPhase("setup")}
            >
              Einstellungen
            </button>
            {/* Weg zurück zum Deck wie beim Karteikarten-Ergebnis (#499) */}
            <Link
              href={`/dashboard/deck/${deckId}`}
              className="btn btn-ghost btn-block"
              style={{ border: "none", boxShadow: "none" }}
            >
              Zurück zum Deck
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Spielen ----------
  const progress = round.length > 0 ? (idx + (revealed ? 1 : 0)) / round.length : 0;
  return (
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
        {/* Grün bei 100 % wie die App und die Lernansicht (#595). */}
        <div className="progress">
          <i
            style={{
              width: `${Math.max(progress * 100, 2)}%`,
              ...(progress >= 1 ? { background: "var(--green)" } : {}),
            }}
          />
        </div>
        <span className="muted" style={{ fontWeight: 700, fontSize: "0.9rem" }}>
          Karte {idx + 1} von {round.length}
        </span>
      </div>

      <div className="cl-prompt">
        <div className="cl-eyebrow">
          {parsed?.isCloze ? "Ergänze die Lücke" : "Wie lautet die Antwort?"}
        </div>
        <div className="cl-q">{parsed?.prompt}</div>
      </div>

      <input
        ref={inputRef}
        className={`cl-input${revealed ? (wasCorrect ? " ok" : nearMiss ? " near" : " no") : ""}`}
        placeholder="Antwort eintippen…"
        value={revealed ? result?.input ?? "" : input}
        disabled={revealed}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim().length > 0) {
            e.preventDefault();
            check();
          }
        }}
      />

      {revealed && (
        <div className={`cl-fb ${wasCorrect ? "ok" : nearMiss ? "near" : "no"}`}>
          <span className="cl-fb__ic" aria-hidden>
            {wasCorrect ? (
              <CheckCircle size={22} />
            ) : nearMiss ? (
              <AlertTriangle size={22} />
            ) : (
              <X size={22} />
            )}
          </span>
          <div>
            <b>
              {wasCorrect
                ? "Richtig"
                : nearMiss
                  ? "Fast — achte auf die Großschreibung"
                  : "Falsch"}
            </b>
            <div className="cl-fb__sol">Lösung: {parsed?.answer}</div>
          </div>
        </div>
      )}

      {revealed && !wasCorrect && (
        <button type="button" className="cl-override" onClick={override}>
          <Check size={18} /> Trotzdem als richtig zählen
        </button>
      )}

      <div className="cl-actions">
        <button
          type="button"
          className="cl-back"
          onClick={back}
          disabled={idx <= floor}
          aria-label="Vorherige Karte"
        >
          <ArrowLeft size={22} />
        </button>
        {revealed ? (
          <button type="button" className="btn btn-primary" onClick={next}>
            {idx + 1 >= round.length ? "Zur Auswertung" : "Weiter"}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary"
              onClick={check}
              disabled={input.trim().length === 0}
            >
              Prüfen
            </button>
            <button type="button" className="btn btn-ghost" onClick={dontKnow}>
              Weiß ich nicht
            </button>
          </>
        )}
      </div>
    </div>
  );
}
