"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { LearnSession } from "@/components/app/learn-session";
import { listCardsInDeck, isApiError, type Card } from "@/lib/api";
import { useWobblyIds } from "@/lib/use-wobbly-ids";
import { filterBySource, isCardDue, type CardSource } from "@/lib/card-source";
import { loadSetup, resolveSource, saveSetup } from "@/lib/setup-memory";
import { CardSourcePicker } from "@/components/app/card-source-picker";
import { isProgressUsable, type SessionProgress } from "@/lib/session-progress";
import { loadBestProgress } from "@/lib/session-progress-sync";
import { Layers, ArrowLeft, AlertTriangle } from "@/components/icons";

export default function LearnPage() {
  const params = useParams<{ id: string }>();
  const deckId = params.id;

  // Alle lernbaren Karten des Decks (ohne Bild-Occlusion). Vorrat für die
  // Kartenquelle-Auswahl; die tatsächlich gespielte Runde steht in `pool`.
  const [studyable, setStudyable] = useState<Card[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<CardSource>("all");
  const { ids: wobblyIds, settled: wobblySettled } = useWobblyIds(deckId);
  // Karteikarten hatten bisher keinen Vorschalt-Schritt. Jetzt wird die
  // Kartenquelle gewählt (#523) — außer die Runde kommt als Deep-Link mit
  // ?cards=… (z. B. „Wackelkandidaten üben" aus der Statistik): dann ist die
  // Auswahl schon getroffen und es geht direkt los.
  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [pool, setPool] = useState<Card[] | null>(null);
  // Wo eine frühere Runde dieses Decks stand, falls gemerkt. Wird nur
  // ANGEBOTEN, nie angewendet — ein Stand von vor Tagen muss nicht mehr das
  // sein, was man jetzt will.
  const [saved, setSaved] = useState<SessionProgress | null>(null);
  // Einstiegskarte, sobald „Weitermachen" gewählt wurde; undefined = ganz vorn.
  const [resumeAt, setResumeAt] = useState<number | undefined>(undefined);
  // Gezielte Sonderrunde über ?cards= (z. B. „Wackelkandidaten üben" aus der
  // Statistik): kurze Runden ohne Weitermachen — weder speichern noch anbieten.
  const [adhocRound, setAdhocRound] = useState(false);
  // ?cards=wobbly heißt „alle Wackelkandidaten dieses Decks" (#682). Die IDs
  // stehen bewusst NICHT im Link — es können bis zu 100 sein. Aufgelöst wird
  // erst, wenn Karten UND Wackelkandidaten da sind.
  const [wobblyDeepLink, setWobblyDeepLink] = useState(false);

  const load = useCallback(async () => {
    if (!deckId) return;
    try {
      const { cards: c } = await listCardsInDeck(deckId);
      // Bild-Occlusion-Karten gehören nur in den Occlusion-Modus (kein Bild hier).
      const study = c.filter((x) => x.type !== "occlusion");
      setStudyable(study);
      // Gezieltes Üben: ?cards=id1,id2 beschränkt die Runde auf genau diese
      // Karten und überspringt die Auswahl.
      const cardsParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("cards")
          : null;
      if (cardsParam === "wobbly") {
        setWobblyDeepLink(true);
      } else {
        const wanted = cardsParam ? new Set(cardsParam.split(",").filter(Boolean)) : null;
        if (wanted) {
          const subset = study.filter((x) => wanted.has(x.id));
          setPool(subset.length > 0 ? subset : study);
          setAdhocRound(true);
          setPhase("play");
        }
      }
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

  // ?cards=wobbly auflösen, sobald Karten und Wackelkandidaten da sind (#682).
  // Genau einmal — danach darf eine nachladende Statistik die laufende Runde
  // nicht mehr umbauen.
  const wobblyDeepLinkRef = useRef(false);
  useEffect(() => {
    if (wobblyDeepLinkRef.current) return;
    if (!wobblyDeepLink || !studyable || !wobblySettled) return;
    wobblyDeepLinkRef.current = true;
    const subset = studyable.filter((c) => wobblyIds.has(c.id));
    // Leere Menge (z. B. Statistik nicht erreichbar): lieber das ganze Deck als
    // eine leere Runde — dieselbe Regel wie beim ?cards=-Deep-Link.
    setPool(subset.length > 0 ? subset : studyable);
    setAdhocRound(true);
    setPhase("play");
  }, [wobblyDeepLink, studyable, wobblyIds, wobblySettled]);

  // Gemerkten Lernstand einmal je Seite lesen — lokal UND aus dem Konto, der
  // neuere gilt (#610). Das Angebot unten erscheint nur, solange er zum Stapel
  // der aktuellen Auswahl passt.
  useEffect(() => {
    if (!deckId) return;
    let active = true;
    void loadBestProgress(deckId, "flashcards").then((progress) => {
      if (active) setSaved(progress);
    });
    return () => {
      active = false;
    };
  }, [deckId]);

  // #610: Die Kartenquelle der letzten Runde vorbelegen — erst wenn Karten UND
  // Wackelkandidaten da sind, denn übernommen wird nur eine Quelle, die heute
  // wieder Karten hätte. Wer schon selbst gewählt hat, wird nicht übersteuert.
  const setupRestoredRef = useRef(false);
  const setupTouchedRef = useRef(false);
  useEffect(() => {
    if (setupRestoredRef.current || setupTouchedRef.current) return;
    if (phase !== "setup" || !studyable || !wobblySettled) return;
    setupRestoredRef.current = true;
    const stored = loadSetup(deckId, "flashcards");
    const counts = {
      starred: studyable.filter((c) => c.starred).length,
      wobbly: studyable.filter((c) => wobblyIds.has(c.id)).length,
      due: studyable.filter((c) => isCardDue(c)).length,
    };
    const wanted = resolveSource(stored?.source, counts);
    if (wanted) setSource(wanted);
    // Ohne gemerkte Wahl ist das Tagespensum die Voreinstellung (#610):
    // „Nur fällige", sobald es gerade welche gibt.
    else if (!stored?.source && counts.due > 0) setSource("due");
  }, [deckId, phase, studyable, wobblyIds, wobblySettled]);

  // Nur anbieten, solange der Stand wirklich brauchbar ist: gleiche
  // Kartenquelle, und an der gemerkten Position liegt noch dieselbe Karte
  // (seitdem können Karten dazugekommen, gelöscht oder entmarkiert sein).
  // Ein Wechsel der Quelle blendet das Angebot aus — ein Index in den einen
  // Stapel sagt nichts über den anderen.
  const chosenPool = studyable ? filterBySource(studyable, source, wobblyIds) : [];
  const canResume =
    saved !== null &&
    isProgressUsable(
      saved,
      chosenPool.map((c) => c.id),
      source
    );

  function start(startAtCard?: number) {
    if (!studyable) return;
    // Beim Start die Wahl für dieses Deck merken (#610) — nächstes Öffnen
    // beginnt dann so, wie die letzte Runde wirklich lief.
    saveSetup(deckId, "flashcards", { source });
    // Leere Auswahl kann nur „all" sein (die anderen sind bei 0 gesperrt) —
    // dann bleibt es beim ganzen Deck.
    setPool(chosenPool.length > 0 ? chosenPool : studyable);
    setResumeAt(startAtCard);
    setPhase("play");
  }

  // Beim ?cards=wobbly-Deep-Link weiterdrehen, bis die Menge steht — sonst
  // blitzt die Kartenquelle-Auswahl kurz auf, bevor die Runde startet. Ein
  // Ladefehler geht vor, sonst drehte der Kreisel endlos.
  if (loading || (wobblyDeepLink && phase === "setup" && !error))
    return <div className="spinner" />;

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

  if (!studyable || studyable.length === 0) {
    return (
      <div className="empty-state">
        <div className="ic" aria-hidden>
          <Layers size={30} />
        </div>
        <h3>Keine Karten zum Lernen</h3>
        <p>Füge dem Deck zuerst ein paar Karten hinzu.</p>
        <Link href={`/dashboard/deck/${deckId}`} className="btn btn-primary">
          Karten hinzufügen
        </Link>
      </div>
    );
  }

  if (phase === "play" && pool && pool.length > 0) {
    return (
      <LearnSession
        pool={pool}
        backHref={`/dashboard/deck/${deckId}`}
        backLabel="Zurück zum Deck"
        startAt={resumeAt}
        // Die unterbrochene Runde lief in einer bestimmten Richtung — die
        // fortgesetzten Karten werden genauso herum abgefragt wie die davor.
        startReverse={resumeAt !== undefined ? saved?.reverse : undefined}
        progressDeckId={adhocRound ? undefined : deckId}
        progressSource={adhocRound ? undefined : source}
      />
    );
  }

  // ---------- Setup ----------
  return (
    <div className="study-wrap">
      <Link href={`/dashboard/deck/${deckId}`} className="crumb">
        <ArrowLeft size={16} /> Zurück zum Deck
      </Link>

      <div className="cl-intro">
        <span
          className="cl-intro__ic"
          aria-hidden
          style={{ background: "rgba(99,102,241,0.14)", color: "var(--brand)" }}
        >
          <Layers size={30} />
        </span>
        <h1 className="h2">Karteikarten</h1>
        <p className="muted">Klassisch umdrehen &amp; bewerten</p>
      </div>

      <CardSourcePicker
        value={source}
        onChange={(next) => {
          // Eigene Wahl schlägt die Vorbelegung — auch wenn die
          // Wackelkandidaten erst danach eintreffen (#610).
          setupTouchedRef.current = true;
          setSource(next);
        }}
        allCount={studyable.length}
        starredCount={studyable.filter((c) => c.starred).length}
        wobblyCount={studyable.filter((c) => wobblyIds.has(c.id)).length}
        dueCount={studyable.filter((c) => isCardDue(c)).length}
      />

      {/* Weitermachen — nur solange eine unterbrochene Runde noch passt */}
      {canResume && saved && (
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block btn-resume"
          onClick={() => start(saved.index)}
        >
          Weitermachen
          <small>
            Karte {saved.index + 1} von {chosenPool.length}
          </small>
        </button>
      )}

      {/* Starten — wird zur Zweitwahl, sobald ein Weitermachen angeboten wird */}
      <button
        type="button"
        className={`btn ${canResume ? "btn-ghost" : "btn-primary"} btn-lg btn-block`}
        onClick={() => start()}
      >
        {canResume ? "Von vorne beginnen" : "Starten"}
      </button>
    </div>
  );
}
