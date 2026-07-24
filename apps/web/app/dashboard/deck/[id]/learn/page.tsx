"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LearnSession } from "@/components/app/learn-session";
import { listCardsInDeck, isApiError, type Card } from "@/lib/api";
import { useWobblyIds } from "@/lib/use-wobbly-ids";
import { filterBySource, type CardSource } from "@/lib/card-source";
import { CardSourcePicker } from "@/components/app/card-source-picker";
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
  const wobblyIds = useWobblyIds(deckId);
  // Karteikarten hatten bisher keinen Vorschalt-Schritt. Jetzt wird die
  // Kartenquelle gewählt (#523) — außer die Runde kommt als Deep-Link mit
  // ?cards=… (z. B. „Wackelkandidaten üben" aus der Statistik): dann ist die
  // Auswahl schon getroffen und es geht direkt los.
  const [phase, setPhase] = useState<"setup" | "play">("setup");
  const [pool, setPool] = useState<Card[] | null>(null);

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
      const wanted = cardsParam ? new Set(cardsParam.split(",").filter(Boolean)) : null;
      if (wanted) {
        const subset = study.filter((x) => wanted.has(x.id));
        setPool(subset.length > 0 ? subset : study);
        setPhase("play");
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

  function start() {
    if (!studyable) return;
    const chosen = filterBySource(studyable, source, wobblyIds);
    // Leere Auswahl kann nur „all" sein (die anderen sind bei 0 gesperrt) —
    // dann bleibt es beim ganzen Deck.
    setPool(chosen.length > 0 ? chosen : studyable);
    setPhase("play");
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
      <LearnSession pool={pool} backHref={`/dashboard/deck/${deckId}`} backLabel="Zurück zum Deck" />
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
        onChange={setSource}
        allCount={studyable.length}
        starredCount={studyable.filter((c) => c.starred).length}
        wobblyCount={studyable.filter((c) => wobblyIds.has(c.id)).length}
      />

      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={start}>
        Starten
      </button>
    </div>
  );
}
