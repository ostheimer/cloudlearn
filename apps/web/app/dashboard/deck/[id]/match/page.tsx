"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/app/auth-context";
import { earnLp, listCardsInDeck, reviewCard, updateCard, getStats, isApiError, type Card } from "@/lib/api";
import { dailyGoalLine } from "@/lib/daily-goal-line";
import { useDisplayName } from "@/lib/use-display-name";
import { useWobblyIds } from "@/lib/use-wobbly-ids";
import { filterBySource, isCardDue, type CardSource } from "@/lib/card-source";
import { loadSetup, resolveSource, saveSetup } from "@/lib/setup-memory";
import { matchTileTexts } from "@/lib/match-tiles";
import { cardListPreview } from "@/lib/card-display";
import { toggleCardStar } from "@/lib/toggle-card-star";
import { CardSourcePicker } from "@/components/app/card-source-picker";
import { CardEditor } from "@/components/app/card-editor";
import {
  isCardGone,
  persistedReviewCount,
  unsavedReviewsNotice,
} from "@/lib/unsaved-reviews";
import {
  ArrowLeft,
  X,
  Match,
  Clock,
  Trophy,
  RotateCw,
  Star,
  StarFilled,
  Pencil,
  Zap,
  AlertTriangle,
} from "@/components/icons";

const MAX_PAIRS = 6;

type Tile = { id: string; text: string; cardId: string; side: "front" | "back" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const x = s % 60;
  return `${m}:${x.toString().padStart(2, "0")}`;
}

const bestKey = (deckId: string) => `clearn:zuordnen:best:${deckId}`;

export default function MatchPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;
  const displayName = useDisplayName();
  const router = useRouter();
  const { userId } = useAuth();
  const [earned, setEarned] = useState<number | null>(null);
  // Tagesdeckel des Servers (#611): kam in der earn-Antwort schon immer mit und
  // wurde hier — anders als in den vier übrigen Web-Modi — weggeworfen.
  const [earnCapReached, setEarnCapReached] = useState(false);
  // Verhindert, dass eine Runde zweimal abgerechnet wird.
  const awardedRef = useRef(false);
  // Endgültig verlorene Bewertungen (#605) fürs Ergebnis — hier reicht State,
  // weil Zählen und Abrechnen im selben Ablauf nach dem Speichern passieren.
  const [unsavedCount, setUnsavedCount] = useState(0);
  const [dailyGoalText, setDailyGoalText] = useState<string | null>(null);

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [timed, setTimed] = useState(false);
  const [bestTime, setBestTime] = useState<number | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [source, setSource] = useState<CardSource>("all");
  const { ids: wobblyIds, settled: wobblySettled } = useWobblyIds(deckId);

  const [phase, setPhase] = useState<"setup" | "playing" | "finished">("setup");
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [selected, setSelected] = useState<Tile | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<[string, string] | null>(null);
  const [errors, setErrors] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  // Karten-IDs der Paare, die mindestens einmal falsch zugeordnet wurden
  // („nicht gewusst"). Für die Wiederholung nur dieser Paare.
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set());
  // Stern + Stift NUR im Ergebnis, nicht während der Runde (Laras Entscheidung,
  // #610): der Zeit-Modus soll nicht durchs Bearbeiten unterbrochen werden.
  const [starredMap, setStarredMap] = useState<Record<string, boolean>>({});
  const [editingCard, setEditingCard] = useState<Card | null>(null);

  // Tagesziel im Rundenergebnis (#610): jede Karte wurde schon während der
  // Runde einzeln ans Backend gemeldet, `reviewsToday` ist beim Abschluss also
  // schon aktuell.
  useEffect(() => {
    if (phase !== "finished") return;
    let cancelled = false;
    getStats()
      .then(({ stats }) => {
        if (!cancelled) setDailyGoalText(dailyGoalLine(stats.dailyGoal, stats.reviewsToday));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phase]);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards: c } = await listCardsInDeck(deckId);
      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      setCards(c.filter((x) => x.type !== "occlusion"));
      setError(null);
    } catch (e) {
      setError(isApiError(e) ? e.message : "Karten konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
    try {
      const v = window.localStorage.getItem(bestKey(deckId));
      const n = v ? parseInt(v, 10) : NaN;
      if (!Number.isNaN(n)) setBestTime(n);
    } catch {
      /* localStorage nicht verfügbar */
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  // #610: Die Schalter der letzten Runde sofort beim Öffnen vorbelegen — da
  // steht noch der Spinner, es kann also keine eigene Wahl überschrieben
  // werden. Die Kartenquelle folgt im Effekt darunter, sobald feststeht, ob
  // sie heute wieder Karten hätte.
  useEffect(() => {
    const stored = loadSetup(deckId, "match");
    if (stored?.timed !== undefined) setTimed(stored.timed);
  }, [deckId]);

  const sourceRestoredRef = useRef(false);
  const sourceTouchedRef = useRef(false);
  useEffect(() => {
    if (sourceRestoredRef.current || sourceTouchedRef.current) return;
    if (phase !== "setup" || loading || !wobblySettled) return;
    sourceRestoredRef.current = true;
    const stored = loadSetup(deckId, "match");
    // Zuordnen braucht 2 Paare — eine Quelle mit weniger darf nie vorbelegt
    // werden, sonst steht man vor gesperrtem Start.
    const usable = (n: number) => (n >= 2 ? n : 0);
    const counts = {
      starred: usable(cards.filter((c) => c.starred).length),
      wobbly: usable(cards.filter((c) => wobblyIds.has(c.id)).length),
      due: usable(cards.filter((c) => isCardDue(c)).length),
    };
    const wanted = resolveSource(stored?.source, counts);
    if (wanted) setSource(wanted);
    // Ohne gemerkte Wahl ist das Tagespensum die Voreinstellung (#610).
    else if (!stored?.source && counts.due > 0) setSource("due");
  }, [deckId, phase, loading, wobblySettled, cards, wobblyIds]);

  // Die gewählte Kartenquelle (Alle / Nur markierte / Nur Wackelkandidaten).
  // Spielbar sind nur Karten, deren beide Seiten nach der Aufbereitung (#569)
  // Text haben — reine Bild-Karten ohne Beschriftung ergeben keine Kachel.
  const sourced = filterBySource(cards, source, wobblyIds);
  const playable = sourced.filter((card) => matchTileTexts(card) !== null);
  const pairCount = Math.min(MAX_PAIRS, playable.length);
  const gamePairs = tiles.length / 2;

  const startGameWith = useCallback(
    (sourceCards: Card[], withTimer: boolean) => {
      const usable = sourceCards.flatMap((card) => {
        const texts = matchTileTexts(card);
        return texts ? [{ card, texts }] : [];
      });
      const selectedCards = shuffle(usable).slice(0, Math.min(MAX_PAIRS, usable.length));
      const newTiles: Tile[] = [];
      for (const { card, texts } of selectedCards) {
        newTiles.push({
          id: `${card.id}-front`,
          text: texts.front,
          cardId: card.id,
          side: "front",
        });
        newTiles.push({
          id: `${card.id}-back`,
          text: texts.back,
          cardId: card.id,
          side: "back",
        });
      }
      setTiles(shuffle(newTiles));
      setSelected(null);
      setMatched(new Set());
      setWrong(null);
      setErrors(0);
      setElapsed(0);
      setMissedIds(new Set());
      setIsNewBest(false);
      setEarned(null);
      setEarnCapReached(false);
      setUnsavedCount(0);
      awardedRef.current = false;
      setTimed(withTimer);
      setStarredMap(Object.fromEntries(selectedCards.map(({ card }) => [card.id, card.starred ?? false])));
      setPhase("playing");
    },
    []
  );

  const startGame = useCallback(
    (withTimer: boolean) => {
      // Beim Start die Wahl für dieses Deck merken (#610).
      saveSetup(deckId, "match", { timed: withTimer, source });
      startGameWith(filterBySource(cards, source, wobblyIds), withTimer);
    },
    [deckId, cards, source, wobblyIds, startGameWith]
  );

  // Stoppuhr — läuft nur im Zeit-Modus während des Spiels.
  useEffect(() => {
    if (phase !== "playing" || !timed) return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [phase, timed]);

  // Abschluss erkennen: Bestzeit merken, Wiederholungen buchen, abrechnen.
  useEffect(() => {
    if (phase !== "playing" || tiles.length === 0 || matched.size !== tiles.length) return;
    if (timed) {
      if (bestTime == null || elapsed < bestTime) {
        setBestTime(elapsed);
        setIsNewBest(true);
        try {
          window.localStorage.setItem(bestKey(deckId), String(elapsed));
        } catch {
          /* egal */
        }
      }
    }

    // Eine Bewertung je KARTE, erst am Rundenende — nicht pro Klick. Wer ein
    // Paar zweimal verwechselt, soll dafür nicht zwei Einträge bekommen: die
    // Lernpunkte entstehen aus genau diesen Zeilen.
    //
    // Verwechselt = „nicht gewusst" (again), sonst „gewusst" (good). Der Server
    // schreibt beides, bewegt die Planung aber nur bei den Fehlern — Paare
    // findet man auch durch Ausschluss, ein Treffer beweist also nichts.
    if (userId && !awardedRef.current) {
      awardedRef.current = true;
      const cardIds = Array.from(new Set(tiles.map((t) => t.cardId)));
      void (async () => {
        const outcomes = await Promise.allSettled(
          cardIds.map((cardId) =>
            reviewCard(userId, cardId, missedIds.has(cardId) ? "again" : "good", {
              mode: "match",
            })
          )
        );
        // Karten, die inzwischen gelöscht wurden (#605): endgültig verloren —
        // zählen und im Ergebnis ehrlich ausweisen. Andere Fehler bleiben
        // best-effort wie bisher.
        const gone = outcomes.filter(
          (o) => o.status === "rejected" && isCardGone(o.reason)
        ).length;
        if (gone > 0) setUnsavedCount(gone);
        // Erst nach dem Speichern abrechnen — der Server leitet die Menge aus
        // den gespeicherten Wiederholungen ab, nicht aus einer Behauptung.
        // Beansprucht wird nur, was wirklich gespeichert wurde.
        const saved = persistedReviewCount(cardIds.length, gone);
        if (saved === 0) return;
        try {
          const res = await earnLp("session", saved);
          setEarned(res.granted);
          setEarnCapReached(res.capReached);
        } catch {
          /* LP-Gutschrift ist best-effort */
        }
      })();
    }

    setPhase("finished");
  }, [matched, tiles.length, phase, timed, elapsed, bestTime, deckId, userId, missedIds]);

  function tap(tile: Tile) {
    if (matched.has(tile.id) || wrong) return;
    if (!selected) {
      setSelected(tile);
      return;
    }
    if (selected.id === tile.id) {
      setSelected(null);
      return;
    }
    if (selected.cardId === tile.cardId && selected.side !== tile.side) {
      setMatched((prev) => {
        const next = new Set(prev);
        next.add(selected.id);
        next.add(tile.id);
        return next;
      });
      setSelected(null);
    } else {
      setErrors((e) => e + 1);
      setWrong([selected.id, tile.id]);
      // Beide beteiligten Paare als „nicht gewusst" merken.
      setMissedIds((prev) => {
        const next = new Set(prev);
        next.add(selected.cardId);
        next.add(tile.cardId);
        return next;
      });
      setTimeout(() => {
        setWrong(null);
        setSelected(null);
      }, 600);
    }
  }

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

  if (cards.filter((card) => matchTileTexts(card) !== null).length < 2) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <Match size={30} />
        </div>
        <h3>Zu wenige Karten</h3>
        <p>Zum Zuordnen braucht das Deck mindestens 2 Karten.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Zurück zum Deck
        </Link>
      </div>
    );
  }

  // ---------- Setup ----------
  if (phase === "setup") {
    return (
      <div className="study-wrap">
        <Link href={`/dashboard/deck/${deckId}`} className="crumb">
          <ArrowLeft size={16} /> Zurück zum Deck
        </Link>

        <div className="cl-intro">
          <span
            className="cl-intro__ic"
            aria-hidden
            style={{ background: "rgba(59,130,246,0.14)", color: "var(--info)" }}
          >
            <Match size={30} />
          </span>
          <h1 className="h2">Zuordnen</h1>
          <p className="muted">{pairCount} Paare zuordnen</p>
        </div>

        <CardSourcePicker
          value={source}
          onChange={(next) => {
            // Eigene Wahl schlägt die Vorbelegung — auch wenn die
            // Wackelkandidaten erst danach eintreffen (#610).
            sourceTouchedRef.current = true;
            setSource(next);
          }}
          allCount={cards.length}
          starredCount={cards.filter((c) => c.starred).length}
          wobblyCount={cards.filter((c) => wobblyIds.has(c.id)).length}
          dueCount={cards.filter((c) => isCardDue(c)).length}
          minCount={2}
        />

        <div className="cl-optcard">
          <div className="cl-row">
            <div>
              <div className="cl-row__t">Auf Zeit</div>
              <div className="cl-row__s">
                {timed
                  ? "Stoppuhr läuft mit — schlag deine Bestzeit"
                  : "Entspannt üben, ohne Zeitdruck"}
              </div>
            </div>
            <button
              type="button"
              className={`cl-switch${timed ? " on" : ""}`}
              role="switch"
              aria-checked={timed}
              aria-label="Auf Zeit"
              onClick={() => setTimed((t) => !t)}
            >
              <i />
            </button>
          </div>
        </div>

        {bestTime != null && (
          <div className="cl-optcard">
            <div className="zu-best">
              <span style={{ color: "var(--amber)", flex: "none", display: "grid" }} aria-hidden>
                <Trophy size={18} />
              </span>
              <span className="zu-best__t">Deine Bestzeit</span>
              <b style={{ fontVariantNumeric: "tabular-nums" }}>{formatTime(bestTime)}</b>
            </div>
          </div>
        )}

        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          onClick={() => startGame(timed)}
          disabled={pairCount < 2}
        >
          Starten
        </button>
      </div>
    );
  }

  // ---------- Ergebnis ----------
  if (phase === "finished") {
    const stars = errors === 0 ? 3 : errors <= 2 ? 2 : errors <= 4 ? 1 : 0;
    // „Nicht gewusst" = Paare mit mindestens einem Fehlversuch. Zuordnen braucht
    // mindestens 2 Paare, darum nur ab 2 offenen Paaren anbieten.
    const notKnownCards = cards.filter((c) => missedIds.has(c.id));
    const showSubset = notKnownCards.length >= 2;
    return (
      <div className="study-wrap">
        <div className="study-done">
          {/* Immer die grüne Trophäe im grünen Kreis, auch ohne Zeit-Modus
              (App-Kanon, #595 Teil C). */}
          <div className="big big--ring" aria-hidden>
            <Trophy size={42} />
          </div>
          <div
            style={{
              fontSize: "2.4rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {timed ? formatTime(elapsed) : `Geschafft${displayName ? `, ${displayName}` : ""}!`}
          </div>
          {timed && isNewBest && (
            <span className="lp-pill">
              <Trophy size={15} /> Neue Bestzeit!
            </span>
          )}
          <div className="zu-stars" aria-label={`${stars} von 3 Sternen`}>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                aria-hidden
                style={{ color: i < stars ? "var(--amber)" : "var(--line)" }}
              >
                {i < stars ? <StarFilled size={28} /> : <Star size={28} />}
              </span>
            ))}
          </div>
          <p className="lead" style={{ margin: 0 }}>
            {gamePairs} Paare zugeordnet
          </p>
          <p style={{ margin: 0, fontWeight: 700, color: errors === 0 ? "var(--green)" : "#ef4444" }}>
            {errors === 0 ? "Keine Fehler!" : `${errors} Fehler`}
          </p>
          {timed && !isNewBest && bestTime != null && (
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Bestzeit: {formatTime(bestTime)}
            </p>
          )}
          {/* Ehrliche Zeile (#605): was der Server nie gespeichert hat, weil
              die Karten inzwischen gelöscht wurden. */}
          {unsavedCount > 0 && (
            <p className="study-unsaved">{unsavedReviewsNotice(unsavedCount)}</p>
          )}
          {/* Die Plakette ist wieder da — jetzt zu Recht: Zuordnen schreibt
              seit Schritt 8 eigene Wiederholungen und verdient die Punkte
              selbst. In #362 war sie entfernt worden, weil die Seite damals
              earnLp rief, ohne je eine Wiederholung zu erzeugen: gezeigt wurde,
              was der Server aus dem Übertrag früherer Lern-Sitzungen
              ausschüttete. */}
          {earned !== null && earned > 0 && (
            <span className="lp-pill">
              <Zap size={15} /> +{earned} Lernpunkte
            </span>
          )}
          {/* Der Tagesdeckel — als einziger Web-Modus verschwieg Zuordnen ihn
              (#611). Wortgleich mit den anderen vier Modi und der App. */}
          {earned === 0 && earnCapReached && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              Heutiges Lernpunkte-Limit erreicht — morgen gibt es wieder welche.
            </p>
          )}
          {dailyGoalText && (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              {dailyGoalText}
            </p>
          )}
          {/* Stern + Stift NUR hier im Ergebnis (Laras Entscheidung, #610) —
              nicht live während der Runde, damit der Zeit-Modus nicht durch
              Bearbeiten unterbrochen wird. Reihenfolge nach erstem Auftreten
              der Kacheln, nicht neu gemischt. */}
          {(() => {
            const seen = new Set<string>();
            const roundCards = tiles.flatMap((tile) => {
              if (seen.has(tile.cardId)) return [];
              seen.add(tile.cardId);
              const card = cards.find((c) => c.id === tile.cardId);
              return card ? [card] : [];
            });
            if (roundCards.length === 0) return null;
            return (
              <div style={{ width: "100%", textAlign: "left" }}>
                <div
                  className="muted"
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: 8,
                  }}
                >
                  Karten dieser Runde
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {roundCards.map((card) => {
                    const preview = cardListPreview(card);
                    const missed = missedIds.has(card.id);
                    return (
                      <div
                        key={card.id}
                        className="card-row"
                        style={missed ? { borderColor: "var(--amber)", background: "var(--amber-50)" } : undefined}
                      >
                        <div className="card-row__faces">
                          <div className="card-row__front">{preview.front}</div>
                          <div className="card-row__back">{preview.back}</div>
                        </div>
                        <div className="card-row__actions">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={starredMap[card.id] ? "Markierung entfernen" : "Markieren"}
                            onClick={() => toggleCardStar(card.id, starredMap, setStarredMap)}
                            style={starredMap[card.id] ? { color: "var(--amber)" } : undefined}
                          >
                            {starredMap[card.id] ? <StarFilled size={17} /> : <Star size={17} />}
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label="Karte bearbeiten"
                            onClick={() => setEditingCard(card)}
                          >
                            <Pencil size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {missedIds.size > 0 && (
                  <p className="muted" style={{ fontSize: "0.78rem", marginTop: 8 }}>
                    Orange umrandet: beim Zuordnen nicht auf Anhieb gewusst.
                  </p>
                )}
              </div>
            );
          })()}
          <div style={{ display: "grid", gap: 8, width: "100%", maxWidth: 320 }}>
            {showSubset && (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => startGameWith(notKnownCards, timed)}
              >
                <RotateCw size={18} /> Nur die nicht gewussten ({notKnownCards.length})
              </button>
            )}
            <button
              type="button"
              className={`btn btn-block ${showSubset ? "btn-ghost" : "btn-primary"}`}
              onClick={() => startGame(timed)}
            >
              <RotateCw size={18} /> Alle nochmal
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
        {editingCard && (
          <CardEditor
            initial={editingCard}
            onClose={() => setEditingCard(null)}
            onSubmit={async (front, back) => {
              const { card: updated } = await updateCard(editingCard.id, { front, back });
              setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
              setEditingCard(null);
            }}
          />
        )}
      </div>
    );
  }

  // ---------- Spielen ----------
  const pairs = matched.size / 2;
  return (
    <div className="study-wrap">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          className="crumb"
          style={{ margin: 0, background: "none", border: "none", cursor: "pointer" }}
          onClick={() => {
            setPhase("setup");
          }}
        >
          <X size={16} /> Abbrechen
        </button>
      </div>

      <div className="zu-statbar">
        <span className={`zu-statbar__l${timed ? "" : " mut"}`}>
          {timed ? <Clock size={16} /> : <Match size={16} />}
          <span>{timed ? formatTime(elapsed) : "Üben"}</span>
        </span>
        <span className="zu-statbar__m">
          {pairs} / {gamePairs} Paare
        </span>
        <span
          className="zu-statbar__e"
          style={{ color: errors > 0 ? "#ef4444" : "var(--ink-3)" }}
        >
          {errors} Fehler
        </span>
      </div>

      <div className="zu-grid">
        {tiles.map((tile) => {
          const isMatched = matched.has(tile.id);
          const isSelected = selected?.id === tile.id;
          const isWrong = wrong?.includes(tile.id);
          let cls = "zu-tile";
          if (isMatched) cls += " zu-tile--matched";
          else if (isWrong) cls += " zu-tile--wrong";
          else if (isSelected) cls += " zu-tile--sel";
          return (
            <button
              key={tile.id}
              type="button"
              className={cls}
              disabled={isMatched}
              onClick={() => tap(tile)}
            >
              <span className={`zu-dot zu-dot--${tile.side}`} aria-hidden />
              <span>{tile.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
